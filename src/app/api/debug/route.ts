import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clients = await prisma.client.findMany({
    include: {
      metaAccounts: {
        select: { id: true, adAccountId: true, accountName: true, accessToken: true, syncedAt: true },
      },
      _count: { select: { campaigns: true } },
    },
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      metaAccounts: c.metaAccounts.map((m) => ({
        ...m,
        accessToken: m.accessToken ? m.accessToken.substring(0, 20) + "..." : null,
      })),
      campaignCount: c._count.campaigns,
    })),
  });
}
