/**
 * AI Trafficker Engine — The brain of the autopilot system
 *
 * Pulls LIVE data from Meta, evaluates performance, and executes actions:
 * - Pause underperforming ads/adsets (low CTR, high CPC, high frequency)
 * - Scale winners progressively (10-20% budget increases)
 * - Respect max daily budget per client
 * - Log every action with Meta API response
 */

import { PrismaClient } from "@prisma/client";
import {
  getCampaignInsights,
  getAdSets,
  getAds,
  getAdInsights,
  getAdSetInsights,
  updateAdStatus,
  updateAdSetStatus,
  updateAdSetBudget,
} from "./meta";

const prisma = new PrismaClient();

// === THRESHOLDS (defaults, can be overridden per rule) ===
const DEFAULTS = {
  // Pause thresholds
  MIN_CTR: 0.5,           // Below this CTR% → pause ad
  MAX_CPC: 5.0,           // Above this CPC$ → pause ad
  MAX_FREQUENCY: 4.0,     // Above this → creative fatigue, pause
  MIN_IMPRESSIONS: 100,   // Need at least this many impressions before judging

  // Scale thresholds
  GOOD_CTR: 1.5,          // Above this CTR% → candidate for scaling
  GOOD_CPC_UNDER: 2.0,    // CPC must be under this to scale

  // Budget scaling
  BUDGET_INCREASE_PCT: 0.15, // 15% increase per cycle
  MAX_INCREASE_PCT: 0.25,    // Never increase more than 25% at once
  MIN_BUDGET_CENTS: 500,     // $5 minimum daily budget (in cents)
};

interface TraffickerResult {
  clientId: string;
  campaignName: string;
  actions: ActionResult[];
}

interface ActionResult {
  type: "pause_ad" | "pause_adset" | "scale_budget" | "skip";
  targetId: string;
  targetName: string;
  reason: string;
  metaResponse?: any;
  success: boolean;
  details?: Record<string, any>;
}

/**
 * Get the max daily budget for a client (from settings JSON)
 * Returns amount in dollars, or null if no limit
 */
function getClientMaxDailyBudget(settings: any): number | null {
  if (!settings) return null;
  const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
  return parsed.maxDailyBudget || null;
}

/**
 * Calculate current total daily budget across all active adsets for a client
 * Returns total in dollars
 */
async function getCurrentDailySpend(clientId: string, token: string, metaAccountId: string): Promise<number> {
  const campaigns = await prisma.campaign.findMany({
    where: { clientId, status: "ACTIVE" },
    select: { metaId: true },
  });

  let totalBudget = 0;
  for (const camp of campaigns) {
    if (!camp.metaId) continue;
    try {
      const adSets = await getAdSets(camp.metaId, token, true);
      for (const as of adSets.data || []) {
        const budget = parseFloat(as.daily_budget || "0") / 100;
        totalBudget += budget;
      }
    } catch {}
  }
  return totalBudget;
}

/**
 * Evaluate and execute actions for a single campaign
 */
export async function evaluateCampaign(
  campaignId: string,
  campaignMetaId: string,
  campaignName: string,
  clientId: string,
  token: string,
  rules: any[],
  clientSettings: any
): Promise<TraffickerResult> {
  const actions: ActionResult[] = [];
  const maxBudget = getClientMaxDailyBudget(clientSettings);

  // Pull LIVE campaign insights
  let campaignMetrics: any = {};
  try {
    const insights = await getCampaignInsights(campaignMetaId, token);
    campaignMetrics = insights.data?.[0] || {};
  } catch {}

  // Get active adsets with their ads
  let adSetsRes: any = { data: [] };
  try {
    adSetsRes = await getAdSets(campaignMetaId, token, true);
  } catch {}

  for (const adSet of adSetsRes.data || []) {
    // Get live adset insights
    let adSetMetrics: any = {};
    try {
      const insights = await getAdSetInsights(adSet.id, token);
      adSetMetrics = insights.data?.[0] || {};
    } catch {}

    const adSetBudgetCents = parseFloat(adSet.daily_budget || "0");
    const adSetBudgetDollars = adSetBudgetCents / 100;

    // Get ads in this adset
    let adsRes: any = { data: [] };
    try {
      adsRes = await getAds(adSet.id, token, true);
    } catch {}

    let activeAdsCount = (adsRes.data || []).length;

    // === EVALUATE EACH AD ===
    for (const ad of adsRes.data || []) {
      let adMetrics: any = {};
      try {
        const insights = await getAdInsights(ad.id, token);
        adMetrics = insights.data?.[0] || {};
      } catch {}

      const impressions = parseInt(adMetrics.impressions) || 0;
      const ctr = parseFloat(adMetrics.ctr) || 0;
      const cpc = parseFloat(adMetrics.cpc) || 0;
      const frequency = parseFloat(adMetrics.frequency) || 0;
      const spend = parseFloat(adMetrics.spend) || 0;

      // Skip if not enough data
      if (impressions < DEFAULTS.MIN_IMPRESSIONS) {
        actions.push({
          type: "skip",
          targetId: ad.id,
          targetName: ad.name,
          reason: `Solo ${impressions} impresiones, necesita al menos ${DEFAULTS.MIN_IMPRESSIONS} para evaluar`,
          success: true,
        });
        continue;
      }

      // Check custom rules first
      let pausedByRule = false;
      for (const rule of rules) {
        const condition = rule.condition as any;
        const ruleAction = rule.action as any;

        if (ruleAction.type !== "pause_ad") continue;

        const metricValue = getMetricValue(adMetrics, condition.metric);
        if (metricValue === null) continue;

        const triggered = evaluateCondition(metricValue, condition.operator, condition.value);
        if (!triggered) continue;

        // Execute pause
        if (rule.mode === "AUTOPILOT") {
          try {
            const resp = await updateAdStatus(ad.id, token, "PAUSED");
            actions.push({
              type: "pause_ad",
              targetId: ad.id,
              targetName: ad.name,
              reason: `Regla "${rule.name}": ${condition.metric}=${metricValue} ${condition.operator} ${condition.value}`,
              metaResponse: resp,
              success: true,
              details: { ruleId: rule.id, spend, ctr, cpc, frequency },
            });
            activeAdsCount--;
            pausedByRule = true;
          } catch (err: any) {
            actions.push({
              type: "pause_ad",
              targetId: ad.id,
              targetName: ad.name,
              reason: `Error pausando: ${err.message}`,
              success: false,
            });
          }
        }
        break;
      }

      if (pausedByRule) continue;

      // === DEFAULT INTELLIGENCE: Auto-pause bad performers ===

      // High frequency → creative fatigue
      if (frequency > DEFAULTS.MAX_FREQUENCY) {
        try {
          const resp = await updateAdStatus(ad.id, token, "PAUSED");
          actions.push({
            type: "pause_ad",
            targetId: ad.id,
            targetName: ad.name,
            reason: `Frecuencia ${frequency.toFixed(1)} > ${DEFAULTS.MAX_FREQUENCY} — creativo fatigado`,
            metaResponse: resp,
            success: true,
            details: { spend, ctr, cpc, frequency },
          });
          activeAdsCount--;
        } catch (err: any) {
          actions.push({
            type: "pause_ad",
            targetId: ad.id,
            targetName: ad.name,
            reason: `Error pausando por frecuencia: ${err.message}`,
            success: false,
          });
        }
        continue;
      }

      // Very low CTR
      if (ctr < DEFAULTS.MIN_CTR && impressions >= DEFAULTS.MIN_IMPRESSIONS * 3) {
        try {
          const resp = await updateAdStatus(ad.id, token, "PAUSED");
          actions.push({
            type: "pause_ad",
            targetId: ad.id,
            targetName: ad.name,
            reason: `CTR ${ctr.toFixed(2)}% < ${DEFAULTS.MIN_CTR}% con ${impressions} impresiones — bajo rendimiento`,
            metaResponse: resp,
            success: true,
            details: { spend, ctr, cpc, frequency },
          });
          activeAdsCount--;
        } catch (err: any) {
          actions.push({
            type: "pause_ad",
            targetId: ad.id,
            targetName: ad.name,
            reason: `Error pausando por CTR bajo: ${err.message}`,
            success: false,
          });
        }
        continue;
      }

      // Very high CPC
      if (cpc > DEFAULTS.MAX_CPC && impressions >= DEFAULTS.MIN_IMPRESSIONS * 2) {
        try {
          const resp = await updateAdStatus(ad.id, token, "PAUSED");
          actions.push({
            type: "pause_ad",
            targetId: ad.id,
            targetName: ad.name,
            reason: `CPC $${cpc.toFixed(2)} > $${DEFAULTS.MAX_CPC} — demasiado caro`,
            metaResponse: resp,
            success: true,
            details: { spend, ctr, cpc, frequency },
          });
          activeAdsCount--;
        } catch (err: any) {
          actions.push({
            type: "pause_ad",
            targetId: ad.id,
            targetName: ad.name,
            reason: `Error pausando por CPC alto: ${err.message}`,
            success: false,
          });
        }
        continue;
      }
    }

    // === PAUSE ADSET if no active ads left ===
    if (activeAdsCount === 0 && (adsRes.data || []).length > 0) {
      try {
        const resp = await updateAdSetStatus(adSet.id, token, "PAUSED");
        actions.push({
          type: "pause_adset",
          targetId: adSet.id,
          targetName: adSet.name,
          reason: "Todos los ads fueron pausados — pausando adset",
          metaResponse: resp,
          success: true,
        });
      } catch (err: any) {
        actions.push({
          type: "pause_adset",
          targetId: adSet.id,
          targetName: adSet.name,
          reason: `Error pausando adset: ${err.message}`,
          success: false,
        });
      }
      continue;
    }

    // === SCALE WINNERS: Progressive budget increase ===
    const adSetCtr = parseFloat(adSetMetrics.ctr) || 0;
    const adSetCpc = parseFloat(adSetMetrics.cpc) || 0;
    const adSetImpressions = parseInt(adSetMetrics.impressions) || 0;

    // Only scale if adset is performing well
    if (
      adSetCtr >= DEFAULTS.GOOD_CTR &&
      adSetCpc <= DEFAULTS.GOOD_CPC_UNDER &&
      adSetImpressions >= DEFAULTS.MIN_IMPRESSIONS * 5 &&
      adSetBudgetCents > 0
    ) {
      // Check if we have room in the client's max budget
      if (maxBudget) {
        const currentTotal = await getCurrentDailySpend(clientId, token, "");
        const increase = adSetBudgetDollars * DEFAULTS.BUDGET_INCREASE_PCT;
        const newTotal = currentTotal + increase;

        if (newTotal > maxBudget) {
          actions.push({
            type: "skip",
            targetId: adSet.id,
            targetName: adSet.name,
            reason: `No se escala: gasto total diario ($${currentTotal.toFixed(2)} + $${increase.toFixed(2)} = $${newTotal.toFixed(2)}) supera limite de $${maxBudget}/dia`,
            success: true,
            details: { currentTotal, maxBudget, wouldBeTotal: newTotal },
          });
          continue;
        }
      }

      // Calculate progressive increase (15%, capped at 25%)
      const increasePct = Math.min(DEFAULTS.BUDGET_INCREASE_PCT, DEFAULTS.MAX_INCREASE_PCT);
      const newBudgetCents = Math.round(adSetBudgetCents * (1 + increasePct));

      // Check custom rules for budget scaling
      let shouldScale = true;
      for (const rule of rules) {
        const ruleAction = rule.action as any;
        if (ruleAction.type === "increase_budget" && rule.mode === "AUTOPILOT") {
          // Use rule's percentage if defined
          const customPct = ruleAction.percentage ? parseFloat(ruleAction.percentage) / 100 : increasePct;
          const customNewBudget = Math.round(adSetBudgetCents * (1 + customPct));

          try {
            const resp = await updateAdSetBudget(adSet.id, token, customNewBudget / 100);
            actions.push({
              type: "scale_budget",
              targetId: adSet.id,
              targetName: adSet.name,
              reason: `Regla "${rule.name}": CTR ${adSetCtr.toFixed(2)}% y CPC $${adSetCpc.toFixed(2)} — subiendo budget de $${adSetBudgetDollars.toFixed(2)} a $${(customNewBudget / 100).toFixed(2)}/dia (+${(customPct * 100).toFixed(0)}%)`,
              metaResponse: resp,
              success: true,
              details: {
                ruleId: rule.id,
                oldBudget: adSetBudgetDollars,
                newBudget: customNewBudget / 100,
                increasePct: customPct,
                ctr: adSetCtr,
                cpc: adSetCpc,
              },
            });
          } catch (err: any) {
            actions.push({
              type: "scale_budget",
              targetId: adSet.id,
              targetName: adSet.name,
              reason: `Error escalando budget: ${err.message}`,
              success: false,
            });
          }
          shouldScale = false;
          break;
        }
      }

      // Default scaling if no custom rule matched
      if (shouldScale) {
        try {
          const resp = await updateAdSetBudget(adSet.id, token, newBudgetCents / 100);
          actions.push({
            type: "scale_budget",
            targetId: adSet.id,
            targetName: adSet.name,
            reason: `Buen rendimiento: CTR ${adSetCtr.toFixed(2)}% y CPC $${adSetCpc.toFixed(2)} — subiendo budget de $${adSetBudgetDollars.toFixed(2)} a $${(newBudgetCents / 100).toFixed(2)}/dia (+${(increasePct * 100).toFixed(0)}%)`,
            metaResponse: resp,
            success: true,
            details: {
              oldBudget: adSetBudgetDollars,
              newBudget: newBudgetCents / 100,
              increasePct,
              ctr: adSetCtr,
              cpc: adSetCpc,
            },
          });
        } catch (err: any) {
          actions.push({
            type: "scale_budget",
            targetId: adSet.id,
            targetName: adSet.name,
            reason: `Error escalando budget: ${err.message}`,
            success: false,
          });
        }
      }
    }
  }

  return {
    clientId,
    campaignName,
    actions,
  };
}

/**
 * Save actions to AutopilotLog
 */
export async function logActions(result: TraffickerResult, ruleId?: string) {
  for (const action of result.actions) {
    if (action.type === "skip") continue; // Don't log skips

    await prisma.autopilotLog.create({
      data: {
        clientId: result.clientId,
        ruleId: ruleId || null,
        action: `${action.type}: ${action.targetName}`,
        reason: action.reason,
        metaApiResponse: action.metaResponse || { error: "no response" },
      },
    });
  }
}

// === HELPERS ===

function getMetricValue(metrics: any, metricName: string): number | null {
  const val = metrics[metricName];
  if (val === undefined || val === null) return null;
  return parseFloat(val);
}

function evaluateCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case "gt": return value > threshold;
    case "lt": return value < threshold;
    case "gte": return value >= threshold;
    case "lte": return value <= threshold;
    default: return false;
  }
}
