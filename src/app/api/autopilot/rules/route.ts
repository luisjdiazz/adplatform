import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const rules = await prisma.autopilotRule.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId, name, ruleType, condition, action, mode } = await req.json();

  if (!clientId || !name || !ruleType || !condition || !action) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const rule = await prisma.autopilotRule.create({
    data: { clientId, name, ruleType, condition, action, mode: mode || "COPILOT" },
  });

  return NextResponse.json({ rule });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, isActive, mode } = await req.json();
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const data: any = {};
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (mode) data.mode = mode;

  const rule = await prisma.autopilotRule.update({ where: { id }, data });
  return NextResponse.json({ rule });
}
