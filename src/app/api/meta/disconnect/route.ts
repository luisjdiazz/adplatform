import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId, accountId } = await req.json();
  if (!clientId || !accountId) {
    return NextResponse.json({ error: "clientId y accountId requeridos" }, { status: 400 });
  }

  await prisma.metaAccount.delete({
    where: { id: accountId, clientId },
  });

  return NextResponse.json({ success: true });
}
