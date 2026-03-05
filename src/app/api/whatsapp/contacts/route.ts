import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const contacts = await prisma.whatsAppContact.findMany({
    where: { clientId },
    include: {
      messages: { orderBy: { sentAt: "asc" }, take: 50 },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return NextResponse.json({ contacts });
}
