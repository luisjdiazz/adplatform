import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Delete demo data
  console.log("Borrando datos demo...");

  const demoSlugs = ["tienda-moda", "fitness-pro"];

  // Delete all dependent records for demo clients
  await prisma.ad.deleteMany({ where: { adSet: { campaign: { client: { slug: { in: demoSlugs } } } } } });
  await prisma.adSet.deleteMany({ where: { campaign: { client: { slug: { in: demoSlugs } } } } });
  await prisma.campaign.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.creativeUpload.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.autopilotLog.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.autopilotRule.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.whatsAppMessage.deleteMany({ where: { contact: { client: { slug: { in: demoSlugs } } } } });
  await prisma.whatsAppContact.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.whatsAppTemplate.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.whatsAppFlow.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.metaAccount.deleteMany({ where: { client: { slug: { in: demoSlugs } } } });
  await prisma.client.deleteMany({ where: { slug: { in: demoSlugs } } });

  // Also delete any demo campaigns on QChulo
  await prisma.ad.deleteMany({ where: { adSet: { campaign: { metaId: { startsWith: "demo-" } } } } });
  await prisma.adSet.deleteMany({ where: { campaign: { metaId: { startsWith: "demo-" } } } });
  await prisma.campaign.deleteMany({ where: { metaId: { startsWith: "demo-" } } });

  // Delete extra meta accounts (keep only the active one)
  await prisma.metaAccount.deleteMany({
    where: { adAccountId: { not: "1811964516053847" } },
  });

  console.log("Datos demo borrados.");

  // Now sync campaigns from Meta
  const metaAccount = await prisma.metaAccount.findFirst({
    where: { adAccountId: "1811964516053847" },
    include: { client: true },
  });

  if (!metaAccount) {
    console.log("No se encontro la cuenta de Meta");
    return;
  }

  console.log(`Sincronizando campanas de ${metaAccount.client.name}...`);

  const META_API_VERSION = "v20.0";
  const BASE = `https://graph.facebook.com/${META_API_VERSION}`;

  // Get campaigns
  const campaignsRes = await fetch(
    `${BASE}/act_${metaAccount.adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=100&access_token=${metaAccount.accessToken}`
  );
  const campaignsData = await campaignsRes.json();

  if (campaignsData.error) {
    console.error("Error de Meta API:", campaignsData.error.message);
    return;
  }

  console.log(`Encontradas ${campaignsData.data?.length || 0} campanas`);

  for (const camp of campaignsData.data || []) {
    // Get insights
    let metrics = {};
    try {
      const insightsRes = await fetch(
        `${BASE}/${camp.id}/insights?fields=spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,frequency&date_preset=last_7d&access_token=${metaAccount.accessToken}`
      );
      const insightsData = await insightsRes.json();
      if (insightsData.data?.[0]) metrics = insightsData.data[0];
    } catch {}

    await prisma.campaign.upsert({
      where: { metaId: camp.id },
      update: {
        name: camp.name,
        status: camp.status,
        objective: camp.objective,
        budget: parseFloat(camp.daily_budget || camp.lifetime_budget || "0") / 100,
        metrics,
      },
      create: {
        clientId: metaAccount.clientId,
        metaId: camp.id,
        name: camp.name,
        status: camp.status,
        objective: camp.objective,
        budget: parseFloat(camp.daily_budget || camp.lifetime_budget || "0") / 100,
        metrics,
      },
    });

    console.log(`  - ${camp.name} (${camp.status})`);
  }

  console.log("Sync completado!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
