import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPresignedUrl } from "@/lib/storage";

// GET /api/content-scheduler/batches?clientId=xxx
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const batches = await prisma.contentBatch.findMany({
    where: { clientId },
    include: {
      posts: {
        orderBy: { scheduledAt: "asc" },
      },
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Generate presigned URLs so files load directly from R2
  const batchesWithUrls = await Promise.all(
    batches.map(async (b) => ({
      ...b,
      posts: await Promise.all(
        b.posts.map(async (p) => ({
          ...p,
          fileUrl: await toPresignedUrl(p.fileUrl),
        }))
      ),
    }))
  );

  return NextResponse.json({ batches: batchesWithUrls });
}

// POST /api/content-scheduler/batches — Create a new batch
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId, name, brandContext, monthYear } = await req.json();
  if (!clientId || !name || !monthYear) {
    return NextResponse.json({ error: "clientId, name, y monthYear son requeridos" }, { status: 400 });
  }

  const batch = await prisma.contentBatch.create({
    data: {
      clientId,
      name,
      brandContext: brandContext || null,
      monthYear,
    },
  });

  return NextResponse.json({ batch });
}
