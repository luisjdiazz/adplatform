import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaigns, getCampaignInsights, getAdSets, getAds, getAdInsights } from "@/lib/meta";

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
      // Only fetch ACTIVE campaigns (truly running and spending money)
      const campaigns = await getCampaigns({
        accessToken: account.accessToken,
        adAccountId: account.adAccountId,
      }, true);

      // Mark all existing campaigns for this client as non-active before syncing
      await prisma.campaign.updateMany({
        where: { clientId, client: { metaAccounts: { some: { id: account.id } } } },
        data: { status: "PAUSED" },
      });

      for (const camp of campaigns.data || []) {
        // Get campaign insights
        let metrics = {};
        try {
          const insights = await getCampaignInsights(camp.id, account.accessToken);
          if (insights.data?.[0]) metrics = insights.data[0];
        } catch {}

        const dbCampaign = await prisma.campaign.upsert({
          where: { metaId: camp.id },
          update: {
            name: camp.name,
            status: camp.effective_status || camp.status,
            objective: camp.objective,
            budget: parseFloat(camp.daily_budget || camp.lifetime_budget || "0") / 100,
            metrics,
          },
          create: {
            clientId,
            metaId: camp.id,
            name: camp.name,
            status: camp.effective_status || camp.status,
            objective: camp.objective,
            budget: parseFloat(camp.daily_budget || camp.lifetime_budget || "0") / 100,
            metrics,
          },
        });
        synced++;

        // Only sync ACTIVE adsets
        try {
          const adSets = await getAdSets(camp.id, account.accessToken, true);
          for (const adSet of adSets.data || []) {
            let adSetMetrics = {};
            try {
              const insights = await getCampaignInsights(adSet.id, account.accessToken);
              if (insights.data?.[0]) adSetMetrics = insights.data[0];
            } catch {}

            const dbAdSet = await prisma.adSet.upsert({
              where: { metaId: adSet.id },
              update: {
                name: adSet.name,
                targeting: adSet.targeting || {},
                budget: parseFloat(adSet.daily_budget || adSet.lifetime_budget || "0") / 100,
                metrics: adSetMetrics,
              },
              create: {
                campaignId: dbCampaign.id,
                metaId: adSet.id,
                name: adSet.name,
                targeting: adSet.targeting || {},
                budget: parseFloat(adSet.daily_budget || adSet.lifetime_budget || "0") / 100,
                metrics: adSetMetrics,
              },
            });

            // Only sync ACTIVE ads
            try {
              const ads = await getAds(adSet.id, account.accessToken, true);
              for (const ad of ads.data || []) {
                let adMetrics = {};
                try {
                  const adInsights = await getAdInsights(ad.id, account.accessToken);
                  if (adInsights.data?.[0]) adMetrics = adInsights.data[0];
                } catch {}

                const thumbnailUrl = ad.creative?.thumbnail_url || null;

                await prisma.ad.upsert({
                  where: { metaId: ad.id },
                  update: {
                    name: ad.name,
                    status: ad.effective_status || ad.status,
                    creativeUrl: thumbnailUrl,
                    metrics: adMetrics,
                  },
                  create: {
                    adSetId: dbAdSet.id,
                    metaId: ad.id,
                    name: ad.name,
                    status: ad.effective_status || ad.status,
                    creativeUrl: thumbnailUrl,
                    metrics: adMetrics,
                  },
                });
              }
            } catch {}
          }
        } catch {}
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
