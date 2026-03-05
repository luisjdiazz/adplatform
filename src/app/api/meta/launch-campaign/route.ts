import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCampaign, createAdSet } from "@/lib/meta";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId, creativeUploadId, campaignData } = await req.json();

  const metaAccount = await prisma.metaAccount.findFirst({ where: { clientId } });
  if (!metaAccount) {
    return NextResponse.json({ error: "No hay cuenta de Meta conectada para este cliente" }, { status: 400 });
  }

  try {
    const opts = { accessToken: metaAccount.accessToken, adAccountId: metaAccount.adAccountId };

    const metaCampaign = await createCampaign(opts, {
      name: campaignData.campaign_name,
      objective: campaignData.objective,
      status: "PAUSED",
    });

    const campaign = await prisma.campaign.create({
      data: {
        clientId,
        metaId: metaCampaign.id,
        name: campaignData.campaign_name,
        status: "PAUSED",
        objective: campaignData.objective,
        budget: campaignData.budget?.daily_budget || 0,
      },
    });

    for (const audience of campaignData.audiences || []) {
      const metaAdSet = await createAdSet(opts, {
        name: audience.name,
        campaignId: metaCampaign.id,
        dailyBudget: (campaignData.budget?.daily_budget || 100) / (campaignData.audiences?.length || 1),
        targeting: audience.targeting,
        bidStrategy: campaignData.budget?.bid_strategy,
      });

      await prisma.adSet.create({
        data: {
          campaignId: campaign.id,
          metaId: metaAdSet.id,
          name: audience.name,
          targeting: audience.targeting,
          budget: (campaignData.budget?.daily_budget || 100) / (campaignData.audiences?.length || 1),
        },
      });
    }

    if (creativeUploadId) {
      await prisma.creativeUpload.update({
        where: { id: creativeUploadId },
        data: { launchedToMeta: true, generatedCampaign: campaignData },
      });
    }

    return NextResponse.json({ campaignId: campaign.id, metaCampaignId: metaCampaign.id });
  } catch (error: any) {
    console.error("Error launching campaign:", error);
    return NextResponse.json({ error: error.message || "Error al crear campana en Meta" }, { status: 500 });
  }
}
