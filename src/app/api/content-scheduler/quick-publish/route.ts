import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInstagramCopyFromImage, generateInstagramCopy } from "@/lib/anthropic";
import { uploadFile, getSignedDownloadUrl } from "@/lib/storage";
import { publishPost } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const action = formData.get("action") as string;
  const clientId = formData.get("clientId") as string;

  if (!clientId) {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { metaAccounts: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // Step 1: Generate AI copy from uploaded file
  if (action === "generate-copy") {
    const file = formData.get("file") as File;
    const userContext = formData.get("userContext") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type;
    const isImage = fileType.startsWith("image/");

    // Upload to R2
    const key = `quick-publish/${clientId}/${Date.now()}-${file.name}`;
    await uploadFile(key, buffer, fileType);
    const fileUrl = await getSignedDownloadUrl(key);

    let aiResult;
    if (isImage) {
      const base64 = buffer.toString("base64");
      const mediaType = fileType as "image/jpeg" | "image/png" | "image/webp";
      aiResult = await generateInstagramCopyFromImage(
        base64,
        mediaType,
        client.brandProfile as Record<string, any>,
        undefined,
        undefined,
        userContext || undefined
      );
    } else {
      // Video — generate copy from description
      const description = userContext || "Reel/video de contenido para la marca";
      aiResult = await generateInstagramCopy(
        description,
        fileType,
        client.brandProfile as Record<string, any>
      );
    }

    return NextResponse.json({
      fileUrl,
      fileKey: key,
      fileType,
      aiResult,
    });
  }

  // Step 2: Publish to Instagram
  if (action === "publish") {
    const metaAccountId = formData.get("metaAccountId") as string;
    const caption = formData.get("caption") as string;
    const hashtags = formData.get("hashtags") as string;
    const fileUrl = formData.get("fileUrl") as string;
    const fileKey = formData.get("fileKey") as string;
    const fileType = formData.get("fileType") as string;

    if (!caption || !fileUrl || !fileType) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    // Find the meta account to use
    const metaAccount = metaAccountId
      ? client.metaAccounts.find((a) => a.id === metaAccountId)
      : client.metaAccounts.find((a) => a.igAccountId);

    if (!metaAccount || !metaAccount.igAccountId) {
      return NextResponse.json({
        error: "No hay cuenta de Instagram conectada. Reconecta tu cuenta de Meta asegurandote de seleccionar una pagina con Instagram vinculado.",
      }, { status: 400 });
    }

    try {
      // Get a public URL for the file
      const signedUrl = await getSignedDownloadUrl(fileKey);
      const fullCaption = hashtags
        ? `${caption}\n\n${hashtags}`
        : caption;

      const result = await publishPost(
        metaAccount.igAccountId,
        metaAccount.accessToken,
        signedUrl,
        fileType,
        fullCaption
      );

      return NextResponse.json({
        success: true,
        mediaId: result.mediaId,
        permalink: result.permalink,
      });
    } catch (error: any) {
      console.error("Quick publish error:", error);
      return NextResponse.json({
        error: error.message || "Error publicando en Instagram",
      }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
}
