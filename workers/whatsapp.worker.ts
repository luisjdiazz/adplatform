import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "whatsapp",
  async (job) => {
    console.log(`[WhatsApp] Procesando job ${job.id}: ${job.name}`);

    if (job.name === "broadcast") {
      const { contacts, templateName, languageCode, clientId } = job.data;
      const { sendTemplateMessage } = await import("../src/lib/whatsapp");

      let sent = 0;
      let failed = 0;

      for (const contact of contacts) {
        try {
          const result = await sendTemplateMessage(contact.phone, templateName, languageCode);
          const waMessageId = result?.messages?.[0]?.id;

          await prisma.whatsAppMessage.create({
            data: {
              contactId: contact.id,
              waMessageId,
              direction: "OUT",
              contentType: "template",
              content: `[Broadcast: ${templateName}]`,
              status: "sent",
            },
          });

          sent++;
          // Rate limiting: max ~80 messages/sec for WhatsApp Business API
          await new Promise((r) => setTimeout(r, 50));
        } catch (error) {
          console.error(`[WhatsApp] Error enviando a ${contact.phone}:`, error);
          failed++;
        }
      }

      console.log(`[WhatsApp] Broadcast completado: ${sent} enviados, ${failed} fallidos`);
      return { sent, failed };
    }
  },
  { connection: connection as any, concurrency: 2 }
);

worker.on("completed", (job) => console.log(`[WhatsApp] Job ${job.id} completado`));
worker.on("failed", (job, err) => console.error(`[WhatsApp] Job ${job?.id} fallo:`, err));

console.log("[WhatsApp] Worker iniciado");
