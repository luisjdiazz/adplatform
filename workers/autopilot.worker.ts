/**
 * Autopilot Worker — Runs on a schedule via BullMQ
 *
 * For each active campaign:
 * 1. Pull LIVE metrics from Meta API
 * 2. Evaluate against rules + default intelligence
 * 3. Execute actions (pause bad ads, scale winners)
 * 4. Log everything
 *
 * Safety: respects maxDailyBudget per client, progressive scaling only
 */

import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";
import { evaluateCampaign, logActions } from "../src/lib/trafficker";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "autopilot",
  async (job) => {
    console.log(`[Autopilot] Procesando job ${job.id}: ${job.name}`);
    const startTime = Date.now();

    // Get all active campaigns with their client's rules and Meta accounts
    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: "ACTIVE", metaId: { not: null } },
      include: {
        client: {
          include: {
            autopilotRules: { where: { isActive: true } },
            metaAccounts: true,
          },
        },
      },
    });

    if (activeCampaigns.length === 0) {
      console.log("[Autopilot] No hay campanas activas con Meta ID, saltando...");
      return { processed: 0, actions: 0 };
    }

    let totalActions = 0;
    const results: string[] = [];

    for (const campaign of activeCampaigns) {
      const metaAccount = campaign.client.metaAccounts[0];
      if (!metaAccount) {
        console.log(`[Autopilot] ${campaign.name}: sin cuenta Meta, saltando`);
        continue;
      }

      const rules = campaign.client.autopilotRules;
      const hasAutopilotRules = rules.some((r) => r.mode === "AUTOPILOT");

      // Only execute if there are AUTOPILOT mode rules, or use default intelligence
      // Default intelligence always runs for safety (pause really bad performers)
      console.log(`[Autopilot] Evaluando: "${campaign.name}" (${rules.length} reglas, cliente: ${campaign.client.name})`);

      try {
        // Check for duplicate runs — don't execute if we already ran in the last hour
        const recentLog = await prisma.autopilotLog.findFirst({
          where: {
            clientId: campaign.client.id,
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
            action: { contains: campaign.name },
          },
          orderBy: { createdAt: "desc" },
        });

        if (recentLog) {
          console.log(`[Autopilot] ${campaign.name}: ya se evaluo hace menos de 1 hora, saltando`);
          continue;
        }

        const result = await evaluateCampaign(
          campaign.id,
          campaign.metaId!,
          campaign.name,
          campaign.client.id,
          metaAccount.accessToken,
          rules,
          campaign.client.settings
        );

        const executedActions = result.actions.filter((a) => a.type !== "skip");
        totalActions += executedActions.length;

        if (executedActions.length > 0) {
          await logActions(result);
          const summary = executedActions.map((a) => `  ${a.success ? "OK" : "FAIL"} ${a.type}: ${a.targetName}`).join("\n");
          console.log(`[Autopilot] ${campaign.name} — ${executedActions.length} acciones:\n${summary}`);
          results.push(`${campaign.name}: ${executedActions.length} acciones`);
        } else {
          console.log(`[Autopilot] ${campaign.name}: todo en orden, sin acciones necesarias`);
        }
      } catch (error: any) {
        console.error(`[Autopilot] Error en campana "${campaign.name}":`, error.message);
        results.push(`${campaign.name}: ERROR - ${error.message}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Autopilot] Completado en ${duration}s — ${activeCampaigns.length} campanas, ${totalActions} acciones ejecutadas`);

    return {
      processed: activeCampaigns.length,
      actions: totalActions,
      duration: `${duration}s`,
      results,
    };
  },
  { connection: connection as any, concurrency: 1 } // concurrency 1 to avoid rate limits
);

worker.on("completed", (job, result) => {
  console.log(`[Autopilot] Job ${job.id} completado:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`[Autopilot] Job ${job?.id} fallo:`, err.message);
});

console.log("[Autopilot] Worker iniciado — esperando jobs...");
