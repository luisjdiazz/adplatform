import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateCampaignPerformance } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { campaignId, kpiTargets } = await req.json();

  if (!campaignId) {
    return NextResponse.json({ error: "campaignId requerido" }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        adSets: { include: { ads: true } },
        client: {
          select: {
            id: true,
            autopilotRules: { where: { isActive: true } },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campana no encontrada" }, { status: 404 });
    }

    const evaluation = await evaluateCampaignPerformance(
      {
        campaign: { id: campaign.id, name: campaign.name, metrics: campaign.metrics },
        adSets: campaign.adSets.map((as) => ({
          id: as.id,
          metaId: as.metaId,
          name: as.name,
          metrics: as.metrics,
          ads: as.ads.map((ad) => ({
            id: ad.id,
            metaId: ad.metaId,
            name: ad.name,
            metrics: ad.metrics,
          })),
        })),
      },
      campaign.client.autopilotRules.map((r) => ({
        id: r.id,
        name: r.name,
        ruleType: r.ruleType,
        condition: r.condition,
        action: r.action,
        mode: r.mode,
      })),
      kpiTargets || { target_cpa: 10, target_roas: 3, max_frequency: 3.5 }
    );

    return NextResponse.json({ evaluation });
  } catch (error: any) {
    console.error("Error evaluating campaign:", error);
    return NextResponse.json({ error: error.message || "Error al evaluar campana" }, { status: 500 });
  }
}
