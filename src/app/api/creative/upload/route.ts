import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadFile } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const clientId = formData.get("clientId") as string;

  if (!file || !clientId) {
    return NextResponse.json({ error: "Archivo y clientId son requeridos" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `creatives/${clientId}/${Date.now()}-${file.name}`;
  const fileUrl = await uploadFile(key, buffer, file.type);

  const upload = await prisma.creativeUpload.create({
    data: { clientId, fileUrl, fileType: file.type },
  });

  return NextResponse.json({ upload });
}
