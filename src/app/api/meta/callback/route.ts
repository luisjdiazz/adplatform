import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getAdAccounts } from "@/lib/meta";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=meta_oauth_failed", req.url));
  }

  const clientId = state.split(":")[1];
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/meta/callback`;

  try {
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    const accounts = await getAdAccounts(tokenData.access_token);

    for (const account of accounts.data || []) {
      await prisma.metaAccount.upsert({
        where: {
          clientId_adAccountId: { clientId, adAccountId: account.account_id },
        },
        update: {
          accessToken: tokenData.access_token,
          accountName: account.name,
          syncedAt: new Date(),
        },
        create: {
          clientId,
          adAccountId: account.account_id,
          accessToken: tokenData.access_token,
          accountName: account.name,
          syncedAt: new Date(),
        },
      });
    }

    return NextResponse.redirect(new URL(`/clients?success=meta_connected`, req.url));
  } catch (error) {
    console.error("Meta OAuth error:", error);
    return NextResponse.redirect(new URL("/settings?error=meta_oauth_failed", req.url));
  }
}
