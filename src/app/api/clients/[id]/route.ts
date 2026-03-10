import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  const body = await req.json();
  const currentSettings = (client.settings as any) || {};

  // Update settings (merge with existing)
  const newSettings = { ...currentSettings };

  if (body.maxDailyBudget !== undefined) {
    newSettings.maxDailyBudget = body.maxDailyBudget ? parseFloat(body.maxDailyBudget) : null;
  }

  const updated = await prisma.client.update({
    where: { id: params.id },
    data: { settings: newSettings },
  });

  return NextResponse.json({ client: updated });
}
