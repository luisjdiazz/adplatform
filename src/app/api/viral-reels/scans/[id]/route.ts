import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - get a specific scan with its reels
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const agencyId = (session.user as any).agencyId;

  const scan = await prisma.reelScan.findFirst({
    where: { id: params.id, agencyId },
    include: {
      client: { select: { id: true, name: true, brandProfile: true } },
      reels: {
        orderBy: [
          { likesCount: "desc" },
        ],
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ scan });
}

// DELETE - delete a scan and its reels
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const agencyId = (session.user as any).agencyId;

  const scan = await prisma.reelScan.findFirst({
    where: { id: params.id, agencyId },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan no encontrado" }, { status: 404 });
  }

  // Cascade delete handles reels
  await prisma.reelScan.delete({ where: { id: params.id } });

  return NextResponse.json({ message: "Scan eliminado" });
}
