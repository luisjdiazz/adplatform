import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const flows = await prisma.whatsAppFlow.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ flows });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId, name, triggerKeyword, steps } = await req.json();

  if (!clientId || !name || !triggerKeyword || !steps) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const flow = await prisma.whatsAppFlow.create({
    data: { clientId, name, triggerKeyword, steps },
  });

  return NextResponse.json({ flow });
}
