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

  const qchulo = await prisma.client.upsert({
    where: { slug: "qchulo" },
    update: {
      brandProfile: {
        industry: "Amazon Affiliate Business",
        tone: "Dominicano, jocoso, cercano, divertido",
        colors: ["#FF6B00", "#232F3E", "#FEBD69"],
        targetAudience: "Publico dominicano y latino que le gusta aprovechar ofertas en Amazon",
        usp: "Filtramos y posteamos las mejores ofertas de Amazon con los mejores precios para nuestra comunidad",
        country: "DO",
        languages: ["es"],
      },
    },
    create: {
      agencyId: agency.id,
      name: "QChulo",
      slug: "qchulo",
      brandProfile: {
        industry: "Amazon Affiliate Business",
        tone: "Dominicano, jocoso, cercano, divertido",
        colors: ["#FF6B00", "#232F3E", "#FEBD69"],
        targetAudience: "Publico dominicano y latino que le gusta aprovechar ofertas en Amazon",
        usp: "Filtramos y posteamos las mejores ofertas de Amazon con los mejores precios para nuestra comunidad",
        country: "DO",
        languages: ["es"],
      },
      isActive: true,
    },
  });

  // Meta account para QChulo
  await prisma.metaAccount.upsert({
    where: { clientId_adAccountId: { clientId: qchulo.id, adAccountId: "1811964516053847" } },
    update: {},
    create: {
      clientId: qchulo.id,
      adAccountId: "1811964516053847",
      accessToken: "pending-oauth",
      accountName: "QChulo Ad Account",
    },
  });

  // Autopilot rules para QChulo
  await prisma.autopilotRule.upsert({
    where: { id: "rule-pause-high-cpa" },
    update: {},
    create: {
      id: "rule-pause-high-cpa",
      clientId: qchulo.id,
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
      clientId: qchulo.id,
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
  console.log(`  - Cliente: ${qchulo.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
