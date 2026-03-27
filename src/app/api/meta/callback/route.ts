import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/meta";
import { prisma } from "@/lib/prisma";

const META_BASE_URL = "https://graph.facebook.com/v20.0";

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
    const accessToken = tokenData.access_token;

    // Fetch Facebook Pages the user granted access to
    const pagesRes = await fetch(
      `${META_BASE_URL}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
    );
    if (!pagesRes.ok) {
      console.error("Failed to fetch pages:", await pagesRes.text());
      throw new Error("Error fetching Facebook pages");
    }
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    if (pages.length === 0) {
      // No pages — save at least the user token so the connection isn't lost
      await prisma.metaAccount.upsert({
        where: {
          clientId_adAccountId: { clientId, adAccountId: `user_${Date.now()}` },
        },
        update: {
          accessToken,
          syncedAt: new Date(),
        },
        create: {
          clientId,
          adAccountId: `user_${Date.now()}`,
          accessToken,
          accountName: "Facebook Account",
          syncedAt: new Date(),
        },
      });
    }

    for (const page of pages) {
      // Check if this page has an Instagram Business account
      let igAccountId: string | null = null;
      let igUsername: string | null = null;

      if (page.instagram_business_account?.id) {
        igAccountId = page.instagram_business_account.id;
        try {
          const igRes = await fetch(
            `${META_BASE_URL}/${igAccountId}?fields=username&access_token=${page.access_token}`
          );
          if (igRes.ok) {
            const igData = await igRes.json();
            igUsername = igData.username || null;
          }
        } catch {
          // IG username fetch failed, continue without it
        }
      }

      // Save each page as a MetaAccount, using page ID as adAccountId
      await prisma.metaAccount.upsert({
        where: {
          clientId_adAccountId: { clientId, adAccountId: page.id },
        },
        update: {
          accessToken: page.access_token,
          accountName: page.name,
          igAccountId,
          igUsername,
          syncedAt: new Date(),
        },
        create: {
          clientId,
          adAccountId: page.id,
          accessToken: page.access_token,
          accountName: page.name,
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
