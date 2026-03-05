import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { name, email, password, agencyName } = await req.json();

  if (!email || !password || !agencyName) {
    return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "El email ya esta registrado" }, { status: 400 });
  }

  const passwordHash = await hash(password, 12);

  const agency = await prisma.agency.create({
    data: { name: agencyName },
  });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      agencyId: agency.id,
    },
  });

  return NextResponse.json({ id: user.id, email: user.email });
}
