import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const agencyId = (session.user as any)?.agencyId;
  const clients = await prisma.client.findMany({
    where: { agencyId },
    include: {
      _count: { select: { campaigns: true, metaAccounts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const agencyId = (session.user as any)?.agencyId;
  if (!agencyId) return NextResponse.json({ error: "Sin agencia asignada" }, { status: 400 });

  const { name, brandProfile } = await req.json();
  if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const existing = await prisma.client.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un cliente con ese nombre" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: { agencyId, name, slug, brandProfile: brandProfile || {} },
    include: { _count: { select: { campaigns: true, metaAccounts: true } } },
  });

  return NextResponse.json({ client });
}
