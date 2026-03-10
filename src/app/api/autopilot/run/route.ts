import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateCampaign, logActions } from "@/lib/trafficker";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId } = await req.json();
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      metaAccounts: true,
      autopilotRules: { where: { isActive: true } },
    },
  }) as any;

  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const metaAccount = client.metaAccounts[0];
  if (!metaAccount) return NextResponse.json({ error: "Sin cuenta Meta vinculada" }, { status: 400 });

  const campaigns = await prisma.campaign.findMany({
    where: { clientId, status: "ACTIVE", metaId: { not: null } },
  });

  if (campaigns.length === 0) {
    return NextResponse.json({ error: "No hay campanas activas" }, { status: 400 });
  }

  const allResults = [];

  for (const campaign of campaigns) {
    try {
      const result = await evaluateCampaign(
        campaign.id,
        campaign.metaId!,
        campaign.name,
        clientId,
        metaAccount.accessToken,
        client.autopilotRules,
        client.settings
      );

      const executed = result.actions.filter((a) => a.type !== "skip");
      if (executed.length > 0) {
        await logActions(result);
      }

      allResults.push({
        campaign: campaign.name,
        totalActions: result.actions.length,
        executed: executed.length,
        actions: result.actions.map((a) => ({
          type: a.type,
          target: a.targetName,
          reason: a.reason,
          success: a.success,
          details: a.details,
        })),
      });
    } catch (error: any) {
      allResults.push({
        campaign: campaign.name,
        error: error.message,
      });
    }
  }

  return NextResponse.json({
    results: allResults,
    summary: {
      campaigns: campaigns.length,
      totalExecuted: allResults.reduce((s, r) => s + (r.executed || 0), 0),
    },
  });
}
