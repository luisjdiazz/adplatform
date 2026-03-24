import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateMonthlySchedule } from "@/lib/anthropic";

// POST /api/content-scheduler/generate-schedule — AI generates optimal schedule
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { batchId, brandContext } = await req.json();
  if (!batchId) {
    return NextResponse.json({ error: "batchId requerido" }, { status: 400 });
  }

  const batch = await prisma.contentBatch.findUnique({
    where: { id: batchId },
    include: {
      posts: true,
      client: true,
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch no encontrado" }, { status: 404 });
  }

  const brandProfile = batch.client.brandProfile as Record<string, any> | null;

  // Build post descriptions from AI analysis or file type
  const postsForSchedule = batch.posts.map((p) => {
    const analysis = p.aiAnalysis as Record<string, any> | null;
    return {
      id: p.id,
      fileType: p.fileType,
      description: analysis?.content_description ||
        analysis?.content_pillar ||
        (p.fileType.startsWith("video") ? "Reel/Video" : "Imagen"),
    };
  });

  const schedule = await generateMonthlySchedule(
    postsForSchedule,
    batch.monthYear,
    brandProfile || undefined,
    brandContext || (batch.brandContext as any)?.context
  );

  // Apply the schedule to posts
  const updatedPosts = [];
  for (const item of schedule.schedule) {
    const dateTime = new Date(`${item.date}T${item.time}:00`);
    const updated = await prisma.scheduledPost.update({
      where: { id: item.postId },
      data: {
        scheduledAt: dateTime,
        status: "SCHEDULED",
      },
    });
    updatedPosts.push(updated);
  }

  // Update batch status
  await prisma.contentBatch.update({
    where: { id: batchId },
    data: { status: "SCHEDULED" },
  });

  return NextResponse.json({
    schedule,
    posts: updatedPosts,
  });
}
