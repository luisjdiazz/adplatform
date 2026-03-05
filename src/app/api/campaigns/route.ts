import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  const agencyId = (session.user as any)?.agencyId;

  const where: any = { client: { agencyId } };
  if (clientId) where.clientId = clientId;

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      client: { select: { name: true } },
      adSets: { include: { ads: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}
