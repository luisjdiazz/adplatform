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

export async function transcribeAudio(
  audioBase64: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            source: { type: "base64", media_type: "audio/mp3", data: audioBase64 },
          } as any,
          {
            type: "text",
            text: "Transcribe el audio completo de este archivo. Si hay musica de fondo, mencionalo. Devuelve SOLO la transcripcion textual, sin formato JSON ni explicaciones adicionales. Si no hay voz humana, indica 'Sin dialogo - solo musica/efectos de sonido'.",
          },
        ],
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function analyzeVideoCreative(
  frames: { base64: string; index: number }[],
  transcription: string | null,
  duration: number,
  brandProfile?: Record<string, any>
) {
  const brandContext = brandProfile
    ? `\nContexto de marca del cliente:\n- Industria: ${brandProfile.industry}\n- Tono: ${brandProfile.tone}\n- Colores de marca: ${brandProfile.colors?.join(", ")}\n- Publico objetivo: ${brandProfile.targetAudience}\n- Propuesta de valor: ${brandProfile.usp}`
    : "";

  const frameContent = frames.map((f) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/jpeg" as const, data: f.base64 },
  }));

  const transcriptionContext = transcription
    ? `\n\nTRANSCRIPCION DEL AUDIO:\n"${transcription}"`
    : "\n\nEl video no tiene dialogo/voz (solo musica o sin audio).";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          ...frameContent,
          {
            type: "text",
            text: `Eres un experto en marketing digital y publicidad en Meta Ads. Analiza este creativo de VIDEO publicitario. Te envio ${frames.length} fotogramas clave extraidos del video (duracion: ${Math.round(duration)}s).${transcriptionContext}${brandContext}

Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "tipo_creativo": "video",
  "duracion_segundos": ${Math.round(duration)},
  "producto": "descripcion del producto/servicio que se anuncia",
  "tono_emocional": "descripcion del tono emocional del video",
  "colores_dominantes": ["color1", "color2", "color3"],
  "cta_implicito": "que accion invita a tomar el video",
  "calidad_visual": {
    "puntuacion": 8,
    "aspectos_positivos": ["aspecto1", "aspecto2"],
    "aspectos_a_mejorar": ["mejora1", "mejora2"]
  },
  "transcripcion": "${transcription ? "la transcripcion completa" : ""}",
  "analisis_audio": {
    "tiene_voz": ${transcription ? "true" : "false"},
    "tono_voz": "descripcion del tono de voz si aplica",
    "musica": "descripcion de la musica de fondo si se detecta en los frames",
    "efectividad_audio": "evaluacion de como el audio complementa el visual"
  },
  "estructura_narrativa": {
    "hook": "que pasa en los primeros 3 segundos para captar atencion",
    "desarrollo": "como se desarrolla el mensaje",
    "cierre": "como termina el video y si tiene CTA claro"
  },
  "texto_detectado": "texto visible en los frames del video",
  "formato_recomendado": "feed/stories/reels",
  "duracion_optima": "si la duracion actual es buena o deberia ajustarse",
  "cumple_20_texto": true,
  "sugerencias": ["sugerencia1", "sugerencia2", "sugerencia3"],
  "score_viral": {
    "puntuacion": 7,
    "factores": ["factor que suma", "factor que resta"]
  }
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

  const isAutoMode = questionnaire.modo === "auto-recommendation";
  const isRefinedMode = questionnaire.modo === "user-refined";

  let userContext = "";
  if (isAutoMode) {
    userContext = `\nMODO: Recomendacion automatica. Basate UNICAMENTE en el analisis del creativo y el perfil de marca para recomendar el mejor objetivo, audiencia, presupuesto y estrategia. Usa tu expertise como trafficker para elegir lo optimo.`;
  } else if (isRefinedMode) {
    userContext = `\nMODO: Refinamiento con input del usuario. El usuario ya vio tu recomendacion inicial y quiere ajustarla.`;
    if (questionnaire.recomendacion_previa) {
      userContext += `\n\nTu recomendacion previa fue:\n${JSON.stringify(questionnaire.recomendacion_previa, null, 2)}`;
    }
    if (questionnaire.objetivo_usuario) {
      userContext += `\nEl usuario quiere como objetivo: ${questionnaire.objetivo_usuario}`;
    }
    if (questionnaire.presupuesto) {
      userContext += `\nPresupuesto diario del usuario: $${questionnaire.presupuesto}`;
    }
    if (questionnaire.pais) {
      userContext += `\nPais objetivo: ${questionnaire.pais}`;
    }
    if (questionnaire.edad_min || questionnaire.edad_max) {
      userContext += `\nRango de edad: ${questionnaire.edad_min || "18"}-${questionnaire.edad_max || "65"}`;
    }
    if (questionnaire.genero && questionnaire.genero !== "") {
      userContext += `\nGenero: ${questionnaire.genero}`;
    }
    if (questionnaire.duracion_dias) {
      userContext += `\nDuracion deseada: ${questionnaire.duracion_dias} dias`;
    }
    if (questionnaire.contexto_adicional) {
      userContext += `\n\nContexto adicional del usuario: "${questionnaire.contexto_adicional}"`;
    }
    userContext += `\n\nAjusta tu recomendacion previa incorporando lo que el usuario especifico. Los campos que el usuario NO lleno, mantenlos de tu recomendacion original.`;
  } else {
    userContext = `\nDatos del cuestionario del cliente:\n${JSON.stringify(questionnaire, null, 2)}`;
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Eres un trafficker digital experto en Meta Ads con anos de experiencia manejando campanas en Latinoamerica y el Caribe. Genera una propuesta completa de campana.

Analisis del creativo:
${JSON.stringify(creativeAnalysis, null, 2)}
${brandContext}${userContext}

Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "campaign_name": "nombre sugerido para la campana",
  "objective": "OUTCOME_SALES | OUTCOME_LEADS | OUTCOME_TRAFFIC | OUTCOME_AWARENESS | OUTCOME_ENGAGEMENT",
  "objective_reasoning": "explicacion de por que recomiendas este objetivo especifico",
  "audiences": [
    {
      "name": "Broad - descripcion",
      "type": "broad",
      "targeting": {
        "age_min": 18,
        "age_max": 65,
        "genders": [],
        "geo_locations": { "countries": ["DO"] },
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
        "geo_locations": { "countries": ["DO"] },
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
    "cta": "SHOP_NOW | LEARN_MORE | SIGN_UP | CONTACT_US | GET_OFFER | SEND_WHATSAPP_MESSAGE"
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

export async function analyzeViralReels(
  reelsData: Record<string, any>[],
  niche: string,
  brandProfile?: Record<string, any>
) {
  const brandContext = brandProfile
    ? `\nPerfil de marca del cliente:\n- Industria: ${brandProfile.industry}\n- Tono: ${brandProfile.tone}\n- Publico objetivo: ${brandProfile.targetAudience}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `Eres un experto en marketing viral de Instagram Reels. Analiza los siguientes reels virales del nicho "${niche}" y extrae patrones accionables.${brandContext}

Datos de ${reelsData.length} reels encontrados:
${JSON.stringify(reelsData.map((r) => ({
  caption: r.caption?.substring(0, 300),
  likes: r.likesCount,
  comments: r.commentsCount,
  views: r.viewsCount,
  shares: r.sharesCount,
  duration: r.duration,
  music: r.musicName,
  hashtags: r.hashtags?.slice(0, 10),
  username: r.ownerUsername,
})), null, 2)}

Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "resumen": "resumen ejecutivo de lo que se encontro en 2-3 oraciones",
  "patrones_virales": [
    {
      "patron": "nombre del patron identificado",
      "descripcion": "explicacion detallada de por que funciona",
      "frecuencia": "en cuantos reels se observo (ej: 8 de 30)",
      "ejemplo_caption": "ejemplo real de los datos"
    }
  ],
  "hooks_efectivos": [
    {
      "tipo": "tipo de hook (pregunta, dato impactante, antes/despues, etc)",
      "ejemplo": "ejemplo concreto extraido de los reels",
      "por_que_funciona": "explicacion psicologica/marketing"
    }
  ],
  "formatos_ganadores": [
    {
      "formato": "nombre del formato (tutorial, storytelling, POV, etc)",
      "duracion_ideal": "rango de duracion en segundos",
      "engagement_promedio": "likes/views ratio aproximado"
    }
  ],
  "hashtags_top": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "musica_trending": ["cancion1", "cancion2", "cancion3"],
  "mejores_cuentas": [
    {
      "username": "@cuenta",
      "por_que": "que hacen bien"
    }
  ],
  "recomendaciones_contenido": [
    {
      "idea": "idea concreta de reel para crear",
      "formato": "formato sugerido",
      "hook": "hook sugerido para abrir",
      "cta": "call to action sugerido",
      "mejor_horario": "horario sugerido de publicacion"
    }
  ],
  "metricas_benchmark": {
    "views_promedio": 0,
    "likes_promedio": 0,
    "engagement_rate_promedio": "0%",
    "duracion_promedio_segundos": 0
  }
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No se pudo parsear la respuesta de Claude");
  return JSON.parse(jsonMatch[0]);
}

export async function remixViralReel(
  reelData: Record<string, any>,
  clientName: string,
  brandProfile?: Record<string, any>,
  customInstructions?: string
) {
  const brandContext = brandProfile
    ? `\nPerfil de marca de "${clientName}":\n- Industria: ${brandProfile.industry || "no especificada"}\n- Tono: ${brandProfile.tone || "no especificado"}\n- Publico objetivo: ${brandProfile.targetAudience || "no especificado"}\n- Colores de marca: ${brandProfile.colors?.join(", ") || "no especificados"}\n- Propuesta de valor: ${brandProfile.usp || "no especificada"}`
    : clientName
      ? `\nCliente: ${clientName} (sin perfil de marca definido, genera ideas genericas adaptables)`
      : "\nNo hay cliente especifico - genera ideas genericas para cualquier marca en este nicho";

  const customContext = customInstructions
    ? `\n\nInstrucciones adicionales del usuario:\n${customInstructions}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [
      {
        role: "user",
        content: `Eres un experto en contenido viral de Instagram y creatividad publicitaria. Tu trabajo es tomar un reel viral exitoso y crear una version adaptada/remixada para una marca especifica.

Datos del reel viral original:
- Nicho: ${reelData.niche}
- Caption: ${reelData.caption || "sin caption"}
- Likes: ${reelData.likesCount?.toLocaleString()}
- Comentarios: ${reelData.commentsCount?.toLocaleString()}
- Views: ${reelData.viewsCount?.toLocaleString()}
- Shares: ${reelData.sharesCount?.toLocaleString()}
- Duracion: ${reelData.duration ? reelData.duration + "s" : "desconocida"}
- Musica: ${reelData.musicName || "desconocida"}
- Hashtags: ${reelData.hashtags?.join(", ") || "ninguno"}
- Cuenta original: @${reelData.ownerUsername || "desconocida"}
${brandContext}${customContext}

Analiza POR QUE este reel se hizo viral y genera un remix adaptado. Responde SIEMPRE en formato JSON con esta estructura exacta:
{
  "viral_analysis": {
    "why_it_worked": "explicacion de 2-3 oraciones de por que este reel se hizo viral",
    "hook_type": "tipo de hook usado (pregunta, dato impactante, visual shock, storytelling, etc)",
    "emotional_trigger": "emocion principal que activa (curiosidad, aspiracion, humor, miedo, etc)",
    "engagement_score": 8.5
  },
  "remix_concept": {
    "title": "titulo corto del concepto remixado",
    "format": "tutorial | storytelling | POV | antes-despues | trend-adaptation | behind-scenes | tips-listicle",
    "description": "descripcion detallada de como ejecutar el reel remixado paso a paso",
    "duration_seconds": 30,
    "scenes": [
      {
        "time": "0-3s",
        "visual": "que se muestra",
        "text_overlay": "texto en pantalla si aplica",
        "audio": "que se escucha"
      }
    ]
  },
  "copy": {
    "hook_opening": "la primera frase/visual que captura atencion (los primeros 1-2 segundos)",
    "caption": "caption completo sugerido con emojis y CTA",
    "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
    "cta": "call to action especifico"
  },
  "production_tips": {
    "music_suggestion": "tipo de musica o cancion trending sugerida",
    "filming_tips": ["tip1", "tip2"],
    "editing_style": "descripcion del estilo de edicion recomendado",
    "best_posting_time": "horario sugerido"
  },
  "variations": [
    {
      "name": "Variacion A",
      "twist": "como cambiar ligeramente el concepto para testear"
    },
    {
      "name": "Variacion B",
      "twist": "otra alternativa para testear"
    }
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
