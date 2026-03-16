import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeCreative, analyzeVideoCreative, transcribeAudio } from "@/lib/anthropic";
import { uploadFile } from "@/lib/storage";
import { processVideo } from "@/lib/video";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 300 * 1024 * 1024; // 300MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const clientId = formData.get("clientId") as string;

  if (!file || !clientId) {
    return NextResponse.json({ error: "Archivo y clientId son requeridos" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Formato no soportado. Usa JPG, PNG, WebP, MP4, MOV o WebM" },
      { status: 400 }
    );
  }

  const isVideo = VIDEO_TYPES.includes(file.type);
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `El archivo no puede pesar mas de ${isVideo ? "300MB" : "10MB"}` },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `creatives/${clientId}/${Date.now()}-${file.name}`;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { brandProfile: true },
    });

    const brandProfile = client?.brandProfile as Record<string, any> | undefined;

    let analysisResult: any;
    let fileUrl: string;

    if (isVideo) {
      // Process video: extract frames and audio
      const { frames, audio, duration } = await processVideo(buffer, file.name);

      // Transcribe audio with Claude if audio exists
      let transcription: string | null = null;
      if (audio) {
        transcription = await transcribeAudio(audio.toString("base64"));
      }

      // Analyze video frames + transcription with Claude
      const frameData = frames.map((f) => ({
        base64: f.buffer.toString("base64"),
        index: f.index,
      }));

      [fileUrl, analysisResult] = await Promise.all([
        uploadFile(key, buffer, file.type),
        analyzeVideoCreative(frameData, transcription, duration, brandProfile),
      ]);
    } else {
      // Image analysis (existing flow)
      const base64 = buffer.toString("base64");

      [fileUrl, analysisResult] = await Promise.all([
        uploadFile(key, buffer, file.type),
        analyzeCreative(
          base64,
          file.type as "image/jpeg" | "image/png" | "image/webp",
          brandProfile
        ),
      ]);
    }

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
