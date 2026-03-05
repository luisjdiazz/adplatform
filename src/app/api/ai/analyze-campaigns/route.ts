import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCampaignSuggestion } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { creativeUploadId, questionnaire } = await req.json();

  if (!creativeUploadId || !questionnaire) {
    return NextResponse.json({ error: "creativeUploadId y cuestionario son requeridos" }, { status: 400 });
  }

  try {
    const upload = await prisma.creativeUpload.findUnique({
      where: { id: creativeUploadId },
      include: { client: { select: { brandProfile: true } } },
    });

    if (!upload || !upload.analysisResult) {
      return NextResponse.json({ error: "Creativo no encontrado o no analizado" }, { status: 404 });
    }

    const suggestion = await generateCampaignSuggestion(
      upload.analysisResult as Record<string, any>,
      questionnaire,
      upload.client.brandProfile as Record<string, any> | undefined
    );

    await prisma.creativeUpload.update({
      where: { id: creativeUploadId },
      data: { generatedCampaign: suggestion },
    });

    return NextResponse.json({ suggestion });
  } catch (error: any) {
    console.error("Error generating campaign:", error);
    return NextResponse.json({ error: error.message || "Error al generar campana" }, { status: 500 });
  }
}
