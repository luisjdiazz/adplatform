import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("admin123", 12);

  const agency = await prisma.agency.upsert({
    where: { id: "agency-demo" },
    update: {},
    create: {
      id: "agency-demo",
      name: "Demo Agency",
      plan: "pro",
      settings: { timezone: "America/Mexico_City", currency: "MXN" },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      passwordHash,
      name: "Admin Demo",
      role: "ADMIN",
      agencyId: agency.id,
    },
  });

  const client1 = await prisma.client.upsert({
    where: { slug: "tienda-moda" },
    update: {},
    create: {
      agencyId: agency.id,
      name: "Tienda de Moda MX",
      slug: "tienda-moda",
      brandProfile: {
        industry: "Moda y Ropa",
        tone: "Juvenil, fresco, aspiracional",
        colors: ["#FF6B9D", "#C44569", "#F8B500"],
        targetAudience: "Mujeres 18-35, urbanas, interesadas en tendencias",
        usp: "Ropa de tendencia a precios accesibles con envio gratis",
      },
      isActive: true,
    },
  });

  const client2 = await prisma.client.upsert({
    where: { slug: "fitness-pro" },
    update: {},
    create: {
      agencyId: agency.id,
      name: "Fitness Pro Gym",
      slug: "fitness-pro",
      brandProfile: {
        industry: "Fitness y Salud",
        tone: "Motivacional, energetico, profesional",
        colors: ["#00B894", "#00CEC9", "#6C5CE7"],
        targetAudience: "Hombres y mujeres 25-45, interesados en fitness",
        usp: "Gimnasio con entrenadores certificados y planes personalizados",
      },
      isActive: true,
    },
  });

  // Campanas ficticias para Tienda de Moda
  const campaign1 = await prisma.campaign.upsert({
    where: { metaId: "demo-campaign-1" },
    update: {},
    create: {
      clientId: client1.id,
      metaId: "demo-campaign-1",
      name: "Venta de Verano 2025",
      status: "ACTIVE",
      objective: "OUTCOME_SALES",
      budget: 500,
      metrics: {
        spend: 234.5,
        impressions: 45000,
        clicks: 1200,
        ctr: 2.67,
        cpc: 0.2,
        conversions: 45,
        cpa: 5.21,
        roas: 4.2,
      },
    },
  });

  await prisma.adSet.upsert({
    where: { metaId: "demo-adset-1" },
    update: {},
    create: {
      campaignId: campaign1.id,
      metaId: "demo-adset-1",
      name: "Mujeres 18-25 Intereses Moda",
      targeting: {
        age_min: 18,
        age_max: 25,
        genders: [2],
        interests: ["Fashion", "Online Shopping"],
        geo: { countries: ["MX"] },
      },
      budget: 250,
      metrics: {
        spend: 120,
        impressions: 25000,
        clicks: 700,
        conversions: 28,
      },
    },
  });

  await prisma.adSet.upsert({
    where: { metaId: "demo-adset-2" },
    update: {},
    create: {
      campaignId: campaign1.id,
      metaId: "demo-adset-2",
      name: "Mujeres 25-35 Lookalike",
      targeting: {
        age_min: 25,
        age_max: 35,
        genders: [2],
        lookalike: { source: "purchasers", percentage: 2 },
        geo: { countries: ["MX"] },
      },
      budget: 250,
      metrics: {
        spend: 114.5,
        impressions: 20000,
        clicks: 500,
        conversions: 17,
      },
    },
  });

  // Campana para Fitness Pro
  await prisma.campaign.upsert({
    where: { metaId: "demo-campaign-2" },
    update: {},
    create: {
      clientId: client2.id,
      metaId: "demo-campaign-2",
      name: "Promocion Enero - Inscripciones",
      status: "ACTIVE",
      objective: "OUTCOME_LEADS",
      budget: 300,
      metrics: {
        spend: 180,
        impressions: 32000,
        clicks: 890,
        ctr: 2.78,
        cpc: 0.2,
        conversions: 32,
        cpa: 5.63,
        roas: 3.1,
      },
    },
  });

  // Autopilot rules
  await prisma.autopilotRule.upsert({
    where: { id: "rule-pause-high-cpa" },
    update: {},
    create: {
      id: "rule-pause-high-cpa",
      clientId: client1.id,
      name: "Pausar ads con CPA alto",
      ruleType: "PAUSE_AD",
      condition: { metric: "cpa", operator: "gt", value: 10 },
      action: { type: "pause", target: "ad" },
      mode: "AUTOPILOT",
      isActive: true,
    },
  });

  await prisma.autopilotRule.upsert({
    where: { id: "rule-increase-budget" },
    update: {},
    create: {
      id: "rule-increase-budget",
      clientId: client1.id,
      name: "Aumentar budget si ROAS alto",
      ruleType: "INCREASE_BUDGET",
      condition: { metric: "roas", operator: "gt", value: 3 },
      action: { type: "increase_budget", percentage: 20, target: "adset" },
      mode: "COPILOT",
      isActive: true,
    },
  });

  console.log("Seed completado:");
  console.log(`  - Agencia: ${agency.name}`);
  console.log(`  - Usuario: ${admin.email} (password: admin123)`);
  console.log(`  - Clientes: ${client1.name}, ${client2.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
