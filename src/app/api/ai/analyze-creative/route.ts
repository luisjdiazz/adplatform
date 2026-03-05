import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeCreative } from "@/lib/anthropic";
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

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Solo se permiten imagenes JPG, PNG o WebP" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo no puede pesar mas de 10MB" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const key = `creatives/${clientId}/${Date.now()}-${file.name}`;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { brandProfile: true },
    });

    const [fileUrl, analysisResult] = await Promise.all([
      uploadFile(key, buffer, file.type),
      analyzeCreative(
        base64,
        file.type as "image/jpeg" | "image/png" | "image/webp",
        client?.brandProfile as Record<string, any> | undefined
      ),
    ]);

    const upload = await prisma.creativeUpload.create({
      data: {
        clientId,
        fileUrl,
        fileType: file.type,
        analysisResult,
      },
    });

    return NextResponse.json({ upload, analysisResult });
  } catch (error: any) {
    console.error("Error analyzing creative:", error);
    return NextResponse.json({ error: error.message || "Error al analizar creativo" }, { status: 500 });
  }
}
