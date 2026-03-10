import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCampaignInsights,
  getCampaignInsightsDaily,
  getAdSets,
  getAds,
  getAdInsights,
  getAdInsightsDaily,
  getAdSetInsights,
} from "@/lib/meta";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      client: {
        select: { name: true, brandProfile: true, metaAccounts: true },
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Campana no encontrada" }, { status: 404 });
  if (!campaign.metaId) return NextResponse.json({ error: "Campana sin ID de Meta" }, { status: 400 });

  const metaAccount = campaign.client.metaAccounts[0];
  if (!metaAccount) return NextResponse.json({ error: "Sin cuenta Meta vinculada" }, { status: 400 });

  const token = metaAccount.accessToken;

  try {
    // Pull LIVE data from Meta API for accurate analysis
    const [campaignInsights7d, campaignInsightsDaily] = await Promise.all([
      getCampaignInsights(campaign.metaId, token).catch(() => ({ data: [] })),
      getCampaignInsightsDaily(campaign.metaId, token).catch(() => ({ data: [] })),
    ]);

    // Get active adsets
    const adSetsRes = await getAdSets(campaign.metaId, token, true).catch(() => ({ data: [] }));
    const adSetsData = [];

    for (const adSet of adSetsRes.data || []) {
      const [adSetInsights, adsRes] = await Promise.all([
        getAdSetInsights(adSet.id, token).catch(() => ({ data: [] })),
        getAds(adSet.id, token, true).catch(() => ({ data: [] })),
      ]);

      const adsData = [];
      for (const ad of adsRes.data || []) {
        const [adInsights7d, adInsightsDaily] = await Promise.all([
          getAdInsights(ad.id, token).catch(() => ({ data: [] })),
          getAdInsightsDaily(ad.id, token).catch(() => ({ data: [] })),
        ]);

        // Extract creative text info
        const creative = ad.creative || {};
        const storySpec = creative.object_story_spec || {};
        const linkData = storySpec.link_data || {};
        const videoData = storySpec.video_data || {};

        adsData.push({
          name: ad.name,
          status: ad.effective_status || ad.status,
          creative_info: {
            title: creative.title || linkData.name || videoData.title || null,
            body: creative.body || linkData.message || videoData.message || null,
            description: linkData.description || null,
            call_to_action: linkData.call_to_action?.type || videoData.call_to_action?.type || null,
            thumbnail_url: creative.thumbnail_url || null,
            image_url: creative.image_url || linkData.image_hash || null,
            type: creative.video_id ? "VIDEO" : "IMAGE",
          },
          metrics_7d: adInsights7d.data?.[0] || {},
          daily_spend: (adInsightsDaily.data || []).map((d: any) => ({
            date: d.date_start,
            spend: d.spend,
            impressions: d.impressions,
            clicks: d.clicks,
            ctr: d.ctr,
            cpc: d.cpc,
          })),
        });
      }

      adSetsData.push({
        name: adSet.name,
        status: adSet.effective_status || adSet.status,
        daily_budget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : null,
        lifetime_budget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : null,
        targeting: adSet.targeting || {},
        optimization_goal: adSet.optimization_goal,
        bid_strategy: adSet.bid_strategy,
        metrics_7d: adSetInsights.data?.[0] || {},
        ads: adsData,
      });
    }

    const liveData = {
      campaign: {
        name: campaign.name,
        objective: campaign.objective,
        daily_budget: campaign.budget,
        status: campaign.status,
        metrics_7d_total: campaignInsights7d.data?.[0] || {},
        daily_breakdown: (campaignInsightsDaily.data || []).map((d: any) => ({
          date: d.date_start,
          spend: d.spend,
          impressions: d.impressions,
          clicks: d.clicks,
          ctr: d.ctr,
          cpc: d.cpc,
          cpm: d.cpm,
          reach: d.reach,
          frequency: d.frequency,
          actions: d.actions,
        })),
      },
      adSets: adSetsData,
    };

    const brandProfile = campaign.client.brandProfile || {};
    const today = new Date().toISOString().split("T")[0];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Eres un trafficker digital EXPERTO en Meta Ads. Analiza esta campana con datos EN VIVO de la API de Meta.

FECHA DE HOY: ${today}
NEGOCIO: ${campaign.client.name}
PERFIL DE MARCA: ${JSON.stringify(brandProfile, null, 2)}

=== DATOS EN VIVO DE META API ===
${JSON.stringify(liveData, null, 2)}

INSTRUCCIONES IMPORTANTES:
- Los datos de "daily_breakdown" son el gasto REAL por dia. Usa estos numeros exactos, NO inventes.
- El "daily_budget" del adset es el presupuesto diario configurado (en dolares). El "spend" del daily_breakdown es lo que realmente se gasto.
- Analiza CADA creativo/ad individualmente: cual tiene mejor CTR, CPC, frecuencia.
- Si un creativo tiene CTR bajo o CPC alto, di exactamente que cambiar (copy, imagen, CTA, audiencia).
- Los "actions" contienen las conversiones reales (link_click, landing_page_view, purchase, etc).
- Calcula el costo por resultado real si hay conversiones.

Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "health_score": 85,
  "health_status": "healthy | warning | critical",
  "summary": "Resumen ejecutivo de 2-3 oraciones. Incluye el gasto diario REAL promedio y el total de los 7 dias.",
  "spend_analysis": {
    "total_7d": "$X.XX",
    "avg_daily_real": "$X.XX",
    "budget_configured": "$X.XX/dia",
    "budget_utilization": "X%",
    "efficiency": "alta | media | baja",
    "explanation": "explicacion detallada del gasto vs resultados. Menciona tendencia de los ultimos dias."
  },
  "audience_analysis": {
    "assessment": "evaluacion del targeting actual",
    "frequency_warning": true/false,
    "suggestions": ["sugerencia1", "sugerencia2"]
  },
  "creative_analysis": {
    "overall_assessment": "evaluacion general de los creativos",
    "per_creative": [
      {
        "name": "nombre del ad",
        "type": "IMAGE o VIDEO",
        "spend_7d": "$X.XX",
        "avg_daily_spend": "$X.XX",
        "ctr": "X.XX%",
        "cpc": "$X.XX",
        "cpm": "$X.XX",
        "frequency": "X.X",
        "verdict": "Excelente | Bueno | Regular | Malo",
        "what_to_improve": "sugerencia especifica para este creativo: cambiar headline, imagen, CTA, etc.",
        "keep_or_kill": "Mantener | Optimizar | Pausar"
      }
    ],
    "best_performing": "nombre del mejor ad",
    "worst_performing": "nombre del peor ad",
    "new_creative_suggestions": ["idea de creativo nuevo 1", "idea 2"]
  },
  "optimization_actions": [
    {
      "priority": "alta | media | baja",
      "action": "accion concreta y especifica",
      "expected_impact": "impacto esperado en metricas",
      "type": "budget | audience | creative | bidding | schedule"
    }
  ],
  "budget_recommendation": {
    "current_daily": X,
    "recommended_daily": X,
    "reasoning": "razon basada en los datos reales"
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
