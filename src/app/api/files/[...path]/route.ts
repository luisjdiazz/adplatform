import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/storage";

// GET /api/files/scheduled/clientId/filename.jpg — Proxy R2 files with signed URLs
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const key = params.path.join("/");
  if (!key) {
    return NextResponse.json({ error: "Path requerido" }, { status: 400 });
  }

  try {
    const signedUrl = await getSignedDownloadUrl(key);
    const fileRes = await fetch(signedUrl);

    if (!fileRes.ok) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
    const buffer = await fileRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err: any) {
    console.error("File proxy error:", err.message);
    return NextResponse.json({ error: "Error al obtener archivo" }, { status: 500 });
  }
}
