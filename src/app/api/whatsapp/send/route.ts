import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendTemplateMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { contactId, message, templateName, languageCode } = await req.json();

  if (!contactId) {
    return NextResponse.json({ error: "contactId requerido" }, { status: 400 });
  }

  const contact = await prisma.whatsAppContact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });

  try {
    let result;
    if (templateName) {
      result = await sendTemplateMessage(contact.phone, templateName, languageCode || "es");
    } else if (message) {
      result = await sendTextMessage(contact.phone, message);
    } else {
      return NextResponse.json({ error: "message o templateName requerido" }, { status: 400 });
    }

    const waMessageId = result?.messages?.[0]?.id;
    await prisma.whatsAppMessage.create({
      data: {
        contactId,
        waMessageId,
        direction: "OUT",
        contentType: templateName ? "template" : "text",
        content: message || `[Template: ${templateName}]`,
        status: "sent",
      },
    });

    return NextResponse.json({ success: true, waMessageId });
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error);
    return NextResponse.json({ error: error.message || "Error al enviar mensaje" }, { status: 500 });
  }
}
