import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { whatsappQueue } from "@/lib/queue";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId, templateName, languageCode, tags } = await req.json();

  if (!clientId || !templateName) {
    return NextResponse.json({ error: "clientId y templateName son requeridos" }, { status: 400 });
  }

  const where: any = { clientId };
  if (tags?.length) {
    where.tags = { hasSome: tags };
  }

  const contacts = await prisma.whatsAppContact.findMany({ where, select: { id: true, phone: true } });

  if (contacts.length === 0) {
    return NextResponse.json({ error: "No se encontraron contactos" }, { status: 400 });
  }

  await whatsappQueue.add("broadcast", {
    contacts: contacts.map((c) => ({ id: c.id, phone: c.phone })),
    templateName,
    languageCode: languageCode || "es",
    clientId,
  });

  return NextResponse.json({ queued: contacts.length });
}
