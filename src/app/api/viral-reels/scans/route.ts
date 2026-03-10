import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeViralContent, mapApifyResult, NICHE_ACCOUNTS } from "@/lib/apify";
import { analyzeViralReels } from "@/lib/anthropic";

// GET - list all scans for the agency
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const agencyId = (session.user as any).agencyId;
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");

  const where: any = { agencyId };
  if (clientId) where.clientId = clientId;

  const scans = await prisma.reelScan.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { reels: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    scans,
    nichePresets: Object.keys(NICHE_ACCOUNTS),
  });
}

// POST - start a new scan
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const agencyId = (session.user as any).agencyId;
  const body = await req.json();
  const { niche, extraAccounts, clientId, maxResults = 30 } = body;

  if (!niche) {
    return NextResponse.json({ error: "Niche es requerido" }, { status: 400 });
  }

  // Get preset accounts for the niche + any custom ones
  const presetAccounts = NICHE_ACCOUNTS[niche] || [];
  const extra = (extraAccounts || []) as string[];
  const accounts = [
    ...new Set([...presetAccounts, ...extra.map((a: string) => a.replace("@", "").trim()).filter(Boolean)]),
  ];

  if (accounts.length === 0) {
    return NextResponse.json(
      { error: "Se necesita al menos una cuenta para escanear" },
      { status: 400 }
    );
  }

  // Create the scan record (store account names in hashtags field for now)
  const scan = await prisma.reelScan.create({
    data: {
      agencyId,
      clientId: clientId || null,
      niche,
      hashtags: accounts, // reusing field to store account names
      status: "SCRAPING",
    },
  });

  // Run scraping in background
  runScanPipeline(scan.id, accounts, niche, maxResults, clientId).catch(
    (err) => {
      console.error(`Scan ${scan.id} failed:`, err);
      prisma.reelScan
        .update({ where: { id: scan.id }, data: { status: "FAILED" } })
        .catch(console.error);
    }
  );

  return NextResponse.json({ scan, message: "Scan iniciado" });
}

async function runScanPipeline(
  scanId: string,
  accounts: string[],
  niche: string,
  maxResults: number,
  clientId?: string
) {
  // Step 1: Scrape from viral accounts via Apify
  const rawItems = await scrapeViralContent(accounts, maxResults);

  // Step 2: Map to our format
  const allMapped = rawItems.map(mapApifyResult);

  // Sort: by engagement (likes + comments), reels first
  const mappedItems = allMapped
    .sort((a, b) => {
      // Primary: total engagement descending
      const engA = a.likesCount + a.commentsCount + a.sharesCount;
      const engB = b.likesCount + b.commentsCount + b.sharesCount;
      if (engB !== engA) return engB - engA;
      // Tiebreaker: reels > carousels > posts
      const typeOrder: Record<string, number> = { REEL: 0, CAROUSEL: 1, POST: 2 };
      return (typeOrder[a.contentType] ?? 2) - (typeOrder[b.contentType] ?? 2);
    })
    .slice(0, maxResults);

  await prisma.reelScan.update({
    where: { id: scanId },
    data: { status: "ANALYZING", totalReels: mappedItems.length },
  });

  // Save content to DB
  for (const item of mappedItems) {
    await prisma.viralReel.create({
      data: { scanId, ...item },
    });
  }

  // Step 3: AI Analysis
  let aiSummary = null;
  if (mappedItems.length > 0) {
    let brandProfile: any = undefined;
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { brandProfile: true },
      });
      if (client?.brandProfile) {
        brandProfile = client.brandProfile as Record<string, any>;
      }
    }

    aiSummary = await analyzeViralReels(mappedItems, niche, brandProfile);
  }

  // Step 4: Mark complete
  await prisma.reelScan.update({
    where: { id: scanId },
    data: {
      status: "COMPLETED",
      aiSummary: aiSummary || undefined,
    },
  });
}
