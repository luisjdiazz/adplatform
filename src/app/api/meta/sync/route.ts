import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaigns, getCampaignInsights } from "@/lib/meta";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId } = await req.json();
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const metaAccounts = await prisma.metaAccount.findMany({ where: { clientId } });
  if (metaAccounts.length === 0) {
    return NextResponse.json({ error: "No hay cuentas de Meta conectadas" }, { status: 400 });
  }

  let synced = 0;
  for (const account of metaAccounts) {
    try {
      const campaigns = await getCampaigns({
        accessToken: account.accessToken,
        adAccountId: account.adAccountId,
      });

      for (const camp of campaigns.data || []) {
        let metrics = {};
        try {
          const insights = await getCampaignInsights(camp.id, account.accessToken);
          if (insights.data?.[0]) metrics = insights.data[0];
        } catch {}

        await prisma.campaign.upsert({
          where: { metaId: camp.id },
          update: {
            name: camp.name,
            status: camp.status,
            objective: camp.objective,
            budget: parseFloat(camp.daily_budget || camp.lifetime_budget || "0") / 100,
            metrics,
          },
          create: {
            clientId,
            metaId: camp.id,
            name: camp.name,
            status: camp.status,
            objective: camp.objective,
            budget: parseFloat(camp.daily_budget || camp.lifetime_budget || "0") / 100,
            metrics,
          },
        });
        synced++;
      }

      await prisma.metaAccount.update({
        where: { id: account.id },
        data: { syncedAt: new Date() },
      });
    } catch (error) {
      console.error(`Error syncing account ${account.adAccountId}:`, error);
    }
  }

  return NextResponse.json({ synced });
}
