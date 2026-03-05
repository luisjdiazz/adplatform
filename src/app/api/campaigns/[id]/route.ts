import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCampaignStatus, deleteCampaign } from "@/lib/meta";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { action } = await req.json();
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: { client: { include: { metaAccounts: true } } },
  });

  if (!campaign) return NextResponse.json({ error: "Campana no encontrada" }, { status: 404 });

  const metaAccount = campaign.client.metaAccounts[0];
  if (!metaAccount || !campaign.metaId) {
    return NextResponse.json({ error: "Sin cuenta Meta vinculada" }, { status: 400 });
  }

  try {
    if (action === "pause") {
      await updateCampaignStatus(campaign.metaId, metaAccount.accessToken, "PAUSED");
      await prisma.campaign.update({ where: { id: params.id }, data: { status: "PAUSED" } });
    } else if (action === "activate") {
      await updateCampaignStatus(campaign.metaId, metaAccount.accessToken, "ACTIVE");
      await prisma.campaign.update({ where: { id: params.id }, data: { status: "ACTIVE" } });
    } else if (action === "archive") {
      await updateCampaignStatus(campaign.metaId, metaAccount.accessToken, "ARCHIVED");
      await prisma.campaign.update({ where: { id: params.id }, data: { status: "ARCHIVED" } });
    } else if (action === "delete") {
      await deleteCampaign(campaign.metaId, metaAccount.accessToken);
      await prisma.ad.deleteMany({ where: { adSet: { campaignId: params.id } } });
      await prisma.adSet.deleteMany({ where: { campaignId: params.id } });
      await prisma.campaign.delete({ where: { id: params.id } });
    } else {
      return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
    }

    return NextResponse.json({ success: true, action });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { name: true, brandProfile: true } },
      adSets: {
        include: {
          ads: true,
        },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campana no encontrada" }, { status: 404 });

  return NextResponse.json({ campaign });
}
