import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { remixViralReel } from "@/lib/anthropic";

// POST - generate a remixed content idea from a viral reel
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { reelId, clientId, customInstructions } = body;

  if (!reelId) {
    return NextResponse.json({ error: "reelId es requerido" }, { status: 400 });
  }

  // Get the reel data
  const reel = await prisma.viralReel.findUnique({
    where: { id: reelId },
    include: { scan: { select: { niche: true } } },
  });

  if (!reel) {
    return NextResponse.json({ error: "Reel no encontrado" }, { status: 404 });
  }

  // Get client brand profile if provided
  let brandProfile: any = undefined;
  let clientName = "";
  if (clientId) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true, brandProfile: true },
    });
    if (client) {
      clientName = client.name;
      if (client.brandProfile) {
        brandProfile = client.brandProfile as Record<string, any>;
      }
    }
  }

  const remix = await remixViralReel(
    {
      caption: reel.caption,
      likesCount: reel.likesCount,
      commentsCount: reel.commentsCount,
      viewsCount: reel.viewsCount,
      sharesCount: reel.sharesCount,
      duration: reel.duration,
      musicName: reel.musicName,
      hashtags: reel.hashtags,
      ownerUsername: reel.ownerUsername,
      niche: reel.scan.niche,
    },
    clientName,
    brandProfile,
    customInstructions
  );

  // Save AI analysis on the reel
  await prisma.viralReel.update({
    where: { id: reelId },
    data: { aiAnalysis: remix },
  });

  return NextResponse.json({ remix });
}
