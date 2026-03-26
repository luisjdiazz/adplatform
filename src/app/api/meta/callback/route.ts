import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getAdAccounts } from "@/lib/meta";
import { getInstagramAccountFromToken } from "@/lib/instagram";
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

    // Try to get Instagram account info linked to this token
    let igAccountId: string | null = null;
    let igUsername: string | null = null;
    try {
      const igInfo = await getInstagramAccountFromToken(tokenData.access_token);
      igAccountId = igInfo.igAccountId;
      // Fetch the IG username
      const igRes = await fetch(
        `https://graph.facebook.com/v20.0/${igInfo.igAccountId}?fields=username&access_token=${igInfo.pageAccessToken}`
      );
      if (igRes.ok) {
        const igData = await igRes.json();
        igUsername = igData.username || null;
      }
    } catch {
      // No Instagram account linked — that's fine, ads-only account
    }

    for (const account of accounts.data || []) {
      await prisma.metaAccount.upsert({
        where: {
          clientId_adAccountId: { clientId, adAccountId: account.account_id },
        },
        update: {
          accessToken: tokenData.access_token,
          accountName: account.name,
          igAccountId,
          igUsername,
          syncedAt: new Date(),
        },
        create: {
          clientId,
          adAccountId: account.account_id,
          accessToken: tokenData.access_token,
          accountName: account.name,
          igAccountId,
          igUsername,
          syncedAt: new Date(),
        },
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || req.url;
    return NextResponse.redirect(new URL(`/clients?success=meta_connected`, baseUrl));
  } catch (error) {
    console.error("Meta OAuth error:", error);
    const baseUrl = process.env.NEXTAUTH_URL || req.url;
    return NextResponse.redirect(new URL("/settings?error=meta_oauth_failed", baseUrl));
  }
}
