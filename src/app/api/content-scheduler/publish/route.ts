import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/storage";
import { getInstagramAccountFromToken, publishPost } from "@/lib/instagram";

// POST /api/content-scheduler/publish — Publish a post to Instagram now
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { postId } = await req.json();
  if (!postId) return NextResponse.json({ error: "postId requerido" }, { status: 400 });

  const post = await prisma.scheduledPost.findUnique({
    where: { id: postId },
    include: {
      client: {
        include: { metaAccounts: true },
      },
    },
  });

  if (!post) return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
  if (!post.caption) return NextResponse.json({ error: "El post necesita un caption antes de publicar" }, { status: 400 });

  const metaAccount = post.client.metaAccounts[0];
  if (!metaAccount) {
    return NextResponse.json({ error: "No hay cuenta de Meta conectada para este cliente" }, { status: 400 });
  }

  // Mark as publishing
  await prisma.scheduledPost.update({
    where: { id: postId },
    data: { status: "PUBLISHING" },
  });

  try {
    // Get Instagram account
    const { igAccountId, pageAccessToken } = await getInstagramAccountFromToken(metaAccount.accessToken);

    // Get a public URL for the file
    const fileUrl = await getSignedDownloadUrl(post.fileKey);

    // Build full caption with hashtags
    const caption = post.caption;

    // Publish
    const result = await publishPost(
      igAccountId,
      pageAccessToken,
      fileUrl,
      post.fileType,
      caption,
      post.thumbnailUrl || undefined
    );

    // Update post with success
    const updated = await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        status: "POSTED",
        publishedAt: new Date(),
        igMediaId: result.mediaId,
        igPermalink: result.permalink,
      },
    });

    return NextResponse.json({ success: true, post: updated, permalink: result.permalink });
  } catch (err: any) {
    // Update post with failure
    await prisma.scheduledPost.update({
      where: { id: postId },
      data: {
        status: "FAILED",
        errorMessage: err.message,
      },
    });

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
