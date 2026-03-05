import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, parseWebhookMessage, markAsRead } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";

  if (process.env.META_APP_SECRET) {
    const isValid = verifyWebhookSignature(bodyText, signature, process.env.META_APP_SECRET);
    if (!isValid) {
      return NextResponse.json({ error: "Firma invalida" }, { status: 401 });
    }
  }

  const body = JSON.parse(bodyText);
  const parsed = parseWebhookMessage(body);

  if (!parsed) {
    return NextResponse.json({ status: "no_message" });
  }

  try {
    const contact = await prisma.whatsAppContact.findFirst({
      where: { phone: parsed.from },
    });

    if (contact) {
      await prisma.whatsAppMessage.create({
        data: {
          contactId: contact.id,
          waMessageId: parsed.messageId,
          direction: "IN",
          contentType: parsed.type,
          content: parsed.text,
        },
      });

      await prisma.whatsAppContact.update({
        where: { id: contact.id },
        data: { lastMessageAt: new Date(), name: parsed.contactName || contact.name },
      });

      // Check for flow triggers
      const flows = await prisma.whatsAppFlow.findMany({
        where: { clientId: contact.clientId, isActive: true },
      });

      for (const flow of flows) {
        if (parsed.text.toLowerCase().includes(flow.triggerKeyword.toLowerCase())) {
          const steps = flow.steps as any[];
          if (steps?.[0]?.message) {
            const { sendTextMessage } = await import("@/lib/whatsapp");
            await sendTextMessage(parsed.from, steps[0].message);
          }
          break;
        }
      }
    }

    await markAsRead(parsed.messageId);
  } catch (error) {
    console.error("Error processing WhatsApp message:", error);
  }

  return NextResponse.json({ status: "ok" });
}
