import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeCreative(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  brandProfile?: Record<string, any>
) {
  const brandContext = brandProfile
    ? `\nContexto de marca del cliente:\n- Industria: ${brandProfile.industry}\n- Tono: ${brandProfile.tone}\n- Colores de marca: ${brandProfile.colors?.join(", ")}\n- Publico objetivo: ${brandProfile.targetAudience}\n- Propuesta de valor: ${brandProfile.usp}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: `Eres un experto en marketing digital y publicidad en Meta Ads. Analiza este creativo publicitario y proporciona un analisis detallado.${brandContext}

Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "producto": "descripcion del producto/servicio que se anuncia",
  "tono_emocional": "descripcion del tono emocional del creativo",
  "colores_dominantes": ["color1", "color2", "color3"],
  "cta_implicito": "que accion invita a tomar el creativo",
  "calidad_visual": {
    "puntuacion": 8,
    "aspectos_positivos": ["aspecto1", "aspecto2"],
    "aspectos_a_mejorar": ["mejora1", "mejora2"]
  },
  "texto_detectado": "texto visible en la imagen si hay",
  "formato_recomendado": "feed/stories/reels",
  "cumple_20_texto": true,
  "sugerencias": ["sugerencia1", "sugerencia2", "sugerencia3"]
}`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No se pudo parsear la respuesta de Claude");
  return JSON.parse(jsonMatch[0]);
}

export async function generateCampaignSuggestion(
  creativeAnalysis: Record<string, any>,
  questionnaire: Record<string, any>,
  brandProfile?: Record<string, any>
) {
  const brandContext = brandProfile
    ? `\nPerfil de marca:\n${JSON.stringify(brandProfile, null, 2)}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Eres un trafficker digital experto en Meta Ads. Basado en el analisis del creativo y el cuestionario del cliente, genera una propuesta completa de campana.

Analisis del creativo:
${JSON.stringify(creativeAnalysis, null, 2)}

Cuestionario del cliente:
${JSON.stringify(questionnaire, null, 2)}
${brandContext}

Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "campaign_name": "nombre sugerido para la campana",
  "objective": "OUTCOME_SALES | OUTCOME_LEADS | OUTCOME_TRAFFIC | OUTCOME_AWARENESS",
  "audiences": [
    {
      "name": "Broad - descripcion",
      "type": "broad",
      "targeting": {
        "age_min": 18,
        "age_max": 65,
        "genders": [],
        "geo_locations": { "countries": ["MX"] },
        "interests": []
      }
    },
    {
      "name": "Intereses - descripcion",
      "type": "interests",
      "targeting": {
        "age_min": 25,
        "age_max": 45,
        "genders": [],
        "geo_locations": { "countries": ["MX"] },
        "interests": [{"id": "6003", "name": "interes"}]
      }
    },
    {
      "name": "Lookalike - descripcion",
      "type": "lookalike",
      "targeting": {
        "age_min": 18,
        "age_max": 55,
        "custom_audiences": [{"id": "lookalike_purchasers_2pct"}]
      }
    }
  ],
  "copy": {
    "headline": "titulo del anuncio (max 40 chars)",
    "primary_text": "texto principal del anuncio",
    "description": "descripcion corta",
    "cta": "SHOP_NOW | LEARN_MORE | SIGN_UP | CONTACT_US | GET_OFFER"
  },
  "budget": {
    "daily_budget": 100,
    "recommended_duration_days": 7,
    "bid_strategy": "LOWEST_COST_WITHOUT_CAP | COST_CAP | BID_CAP",
    "explanation": "explicacion de la estrategia de presupuesto"
  },
  "optimization_tips": [
    "tip1",
    "tip2",
    "tip3"
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No se pudo parsear la respuesta de Claude");
  return JSON.parse(jsonMatch[0]);
}

export async function evaluateCampaignPerformance(
  campaignData: Record<string, any>,
  rules: Record<string, any>[],
  kpiTargets: Record<string, any>
) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Eres un AI Trafficker que evalua campanas de Meta Ads. Analiza las metricas actuales contra los KPIs objetivo y las reglas de autopilot configuradas.

Datos de campana:
${JSON.stringify(campaignData, null, 2)}

Reglas de autopilot activas:
${JSON.stringify(rules, null, 2)}

KPIs objetivo:
${JSON.stringify(kpiTargets, null, 2)}

Responde en JSON con esta estructura:
{
  "status": "healthy | warning | critical",
  "actions": [
    {
      "type": "pause_ad | pause_adset | increase_budget | decrease_budget | rotate_creative",
      "target_id": "id del recurso en Meta",
      "target_name": "nombre del recurso",
      "reason": "explicacion en espanol",
      "rule_id": "id de la regla que lo dispara",
      "requires_approval": false,
      "priority": "high | medium | low"
    }
  ],
  "summary": "resumen general del estado de la campana en espanol",
  "recommendations": ["recomendacion1", "recomendacion2"]
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No se pudo parsear la respuesta de Claude");
  return JSON.parse(jsonMatch[0]);
}
