import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "autopilot",
  async (job) => {
    console.log(`[Autopilot] Procesando job ${job.id}: ${job.name}`);

    const activeCampaigns = await prisma.campaign.findMany({
      where: { status: "ACTIVE" },
      include: {
        client: {
          select: {
            id: true,
            autopilotRules: { where: { isActive: true } },
            metaAccounts: true,
          },
        },
        adSets: { include: { ads: true } },
      },
    });

    if (activeCampaigns.length === 0) {
      console.log("[Autopilot] No hay campanas activas, saltando...");
      return;
    }

    for (const campaign of activeCampaigns) {
      const rules = campaign.client.autopilotRules;
      const metaAccount = campaign.client.metaAccounts[0];
      if (!metaAccount || rules.length === 0) continue;

      const metrics = campaign.metrics as any;

      for (const rule of rules) {
        const condition = rule.condition as any;
        const action = rule.action as any;
        let shouldTrigger = false;

        const metricValue = metrics[condition.metric];
        if (metricValue === undefined) continue;

        switch (condition.operator) {
          case "gt": shouldTrigger = metricValue > condition.value; break;
          case "lt": shouldTrigger = metricValue < condition.value; break;
          case "gte": shouldTrigger = metricValue >= condition.value; break;
          case "lte": shouldTrigger = metricValue <= condition.value; break;
        }

        if (!shouldTrigger) continue;

        if (rule.mode === "AUTOPILOT") {
          console.log(`[Autopilot] Ejecutando regla "${rule.name}" para campana "${campaign.name}"`);
          // Here we would call Meta API to execute the action
          // For now, log the action
        }

        await prisma.autopilotLog.create({
          data: {
            clientId: campaign.client.id,
            ruleId: rule.id,
            action: `${action.type} en ${action.target || "campana"}`,
            reason: `${condition.metric} (${metricValue}) ${condition.operator} ${condition.value}`,
            metaApiResponse: { simulated: true },
          },
        });
      }
    }

    console.log(`[Autopilot] Procesadas ${activeCampaigns.length} campanas`);
  },
  { connection: connection as any, concurrency: 2 }
);

worker.on("completed", (job) => console.log(`[Autopilot] Job ${job.id} completado`));
worker.on("failed", (job, err) => console.error(`[Autopilot] Job ${job?.id} fallo:`, err));

console.log("[Autopilot] Worker iniciado");
