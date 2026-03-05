import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "meta-sync",
  async (job) => {
    console.log(`[MetaSync] Procesando job ${job.id}: ${job.name}`);
    const { clientId } = job.data;

    const metaAccounts = await prisma.metaAccount.findMany({ where: { clientId } });

    for (const account of metaAccounts) {
      try {
        const { getCampaigns, getCampaignInsights } = await import("../src/lib/meta");
        const campaigns = await getCampaigns({
          accessToken: account.accessToken,
          adAccountId: account.adAccountId,
        });

        for (const camp of campaigns.data || []) {
          let metrics = {};
          try {
            const insights = await getCampaignInsights(camp.id, account.accessToken);
            if (insights.data?.[0]) metrics = insights.data[0];
          } catch {}

          await prisma.campaign.upsert({
            where: { metaId: camp.id },
            update: { name: camp.name, status: camp.status, metrics },
            create: {
              clientId,
              metaId: camp.id,
              name: camp.name,
              status: camp.status,
              objective: camp.objective,
              budget: parseFloat(camp.daily_budget || "0") / 100,
              metrics,
            },
          });
        }

        await prisma.metaAccount.update({
          where: { id: account.id },
          data: { syncedAt: new Date() },
        });

        console.log(`[MetaSync] Sync completado para cuenta ${account.adAccountId}`);
      } catch (error) {
        console.error(`[MetaSync] Error en cuenta ${account.adAccountId}:`, error);
      }
    }
  },
  { connection: connection as any, concurrency: 2 }
);

worker.on("completed", (job) => console.log(`[MetaSync] Job ${job.id} completado`));
worker.on("failed", (job, err) => console.error(`[MetaSync] Job ${job?.id} fallo:`, err));

console.log("[MetaSync] Worker iniciado");
