import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOAuthUrl } from "@/lib/meta";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId requerido" }, { status: 400 });

  const state = crypto.randomBytes(16).toString("hex") + ":" + clientId;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/meta/callback`;
  const url = getOAuthUrl(process.env.META_APP_ID!, redirectUri, state);

  return NextResponse.json({ url });
}
