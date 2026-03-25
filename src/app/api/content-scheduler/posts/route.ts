import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile, toPresignedUrl } from "@/lib/storage";

// GET /api/content-scheduler/posts?clientId=xxx&batchId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  const batchId = req.nextUrl.searchParams.get("batchId");

  const where: any = {};
  if (clientId) where.clientId = clientId;
  if (batchId) where.batchId = batchId;

  const posts = await prisma.scheduledPost.findMany({
    where,
    orderBy: [
      { scheduledAt: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
  });

  // Generate presigned URLs so files load directly from R2 in browser
  const postsWithUrls = await Promise.all(
    posts.map(async (p) => ({
      ...p,
      fileUrl: await toPresignedUrl(p.fileUrl),
    }))
  );

  return NextResponse.json({ posts: postsWithUrls });
}

// POST /api/content-scheduler/posts — Upload files and create posts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const clientId = formData.get("clientId") as string;
  const batchId = formData.get("batchId") as string | null;
  const files = formData.getAll("files") as File[];
  const postType = (formData.get("postType") as string) || "SINGLE";
  const carouselGroupId = formData.get("carouselGroupId") as string | null;
  const carouselOrder = formData.get("carouselOrder") ? parseInt(formData.get("carouselOrder") as string) : null;
  const userContext = formData.get("userContext") as string | null;

  if (!clientId || files.length === 0) {
    return NextResponse.json({ error: "clientId y al menos un archivo son requeridos" }, { status: 400 });
  }

  const createdPosts = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `scheduled/${clientId}/${timestamp}-${safeFilename}`;

    const fileUrl = await uploadFile(key, buffer, file.type);

    const post = await prisma.scheduledPost.create({
      data: {
        clientId,
        batchId: batchId || null,
        fileUrl,
        fileKey: key,
        fileType: file.type,
        postType,
        carouselGroupId: carouselGroupId || null,
        carouselOrder: carouselOrder,
        userContext: userContext || null,
        status: "DRAFT",
      },
    });

    createdPosts.push(post);
  }

  // Update batch post count
  if (batchId) {
    const count = await prisma.scheduledPost.count({ where: { batchId } });
    await prisma.contentBatch.update({
      where: { id: batchId },
      data: { totalPosts: count },
    });
  }

  return NextResponse.json({ posts: createdPosts });
}

// PATCH /api/content-scheduler/posts — Update a post
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { postId, caption, hashtags, scheduledAt, status, userContext } = await req.json();
  if (!postId) return NextResponse.json({ error: "postId requerido" }, { status: 400 });

  const data: any = {};
  if (caption !== undefined) data.caption = caption;
  if (hashtags !== undefined) data.hashtags = hashtags;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (status !== undefined) data.status = status;
  if (userContext !== undefined) data.userContext = userContext;

  const post = await prisma.scheduledPost.update({
    where: { id: postId },
    data,
  });

  return NextResponse.json({
    post: { ...post, fileUrl: await toPresignedUrl(post.fileUrl) },
  });
}

// DELETE /api/content-scheduler/posts
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: "postId requerido" }, { status: 400 });

  await prisma.scheduledPost.delete({ where: { id: postId } });

  return NextResponse.json({ success: true });
}
