import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { name: true, brandProfile: true } },
      adSets: { include: { ads: true } },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campana no encontrada" }, { status: 404 });

  const campaignData = {
    name: campaign.name,
    status: campaign.status,
    objective: campaign.objective,
    budget: campaign.budget,
    metrics: campaign.metrics,
    adSets: campaign.adSets.map((adSet) => ({
      name: adSet.name,
      targeting: adSet.targeting,
      budget: adSet.budget,
      metrics: adSet.metrics,
      ads: adSet.ads.map((ad) => ({
        name: ad.name,
        status: ad.status,
        creativeUrl: ad.creativeUrl,
        metrics: ad.metrics,
      })),
    })),
  };

  const brandProfile = campaign.client.brandProfile || {};

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Eres un trafficker digital experto en Meta Ads con anos de experiencia optimizando campanas. Analiza esta campana en detalle y dame recomendaciones accionables para maximizar el rendimiento.

Negocio: ${campaign.client.name}
Perfil de marca: ${JSON.stringify(brandProfile, null, 2)}

Datos completos de la campana:
${JSON.stringify(campaignData, null, 2)}

Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "health_score": 85,
  "health_status": "healthy | warning | critical",
  "summary": "Resumen ejecutivo de 2-3 oraciones sobre el estado general de la campana",
  "spend_analysis": {
    "total_spend": "gasto total formateado",
    "efficiency": "alta | media | baja",
    "explanation": "explicacion del gasto vs resultados"
  },
  "audience_analysis": {
    "assessment": "evaluacion del targeting actual",
    "suggestions": ["sugerencia1", "sugerencia2"]
  },
  "creative_analysis": {
    "assessment": "evaluacion de los creativos",
    "best_performing": "nombre del mejor ad si hay datos",
    "worst_performing": "nombre del peor ad si hay datos",
    "suggestions": ["sugerencia1", "sugerencia2"]
  },
  "optimization_actions": [
    {
      "priority": "alta | media | baja",
      "action": "descripcion de la accion concreta",
      "expected_impact": "impacto esperado",
      "type": "budget | audience | creative | bidding | schedule"
    }
  ],
  "budget_recommendation": {
    "current_daily": 0,
    "recommended_daily": 0,
    "reasoning": "por que se recomienda este presupuesto"
  },
  "predicted_improvements": {
    "ctr_improvement": "+X%",
    "cpc_reduction": "-X%",
    "conversions_increase": "+X%"
  }
}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No se pudo parsear la respuesta de IA");
    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("Error analyzing campaign:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
