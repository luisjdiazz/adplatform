import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  const onlySpending = req.nextUrl.searchParams.get("onlySpending") === "true";
  const agencyId = (session.user as any)?.agencyId;

  const where: any = { client: { agencyId } };
  if (clientId) where.clientId = clientId;

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      client: { select: { name: true } },
      adSets: {
        include: {
          ads: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!onlySpending) {
    return NextResponse.json({ campaigns });
  }

  // Filter to only campaigns with actual spend > 0
  const spending = campaigns.filter((c) => {
    const m = c.metrics as any;
    return parseFloat(m?.spend) > 0;
  }).map((c) => ({
    ...c,
    // Only include adsets with spend > 0
    adSets: c.adSets.filter((as) => {
      const m = as.metrics as any;
      return parseFloat(m?.spend) > 0;
    }).map((as) => ({
      ...as,
      // Only include ads with spend > 0
      ads: as.ads.filter((ad) => {
        const m = ad.metrics as any;
        return parseFloat(m?.spend) > 0;
      }),
    })),
  }));

  return NextResponse.json({ campaigns: spending });
}
