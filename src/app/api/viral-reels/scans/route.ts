import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeViralContent, mapApifyResult } from "@/lib/apify";
import { analyzeViralReels } from "@/lib/anthropic";

// Predefined niches with default hashtags
const NICHE_PRESETS: Record<string, string[]> = {
  "amazon-affiliate": [
    "amazonfinds", "amazonfavorites", "amazonmusthaves", "amazonhaul",
    "amazoninfluencer", "founditonamazon", "amazondeals", "tiktokmademebuyit",
  ],
  "amazon-finds": [
    "amazonfinds", "amazonfind", "amazonfinds2026", "amazonhome",
    "amazonkitchen", "amazongadgets", "amazonfashionfinds", "amazonbeautyfinds",
  ],
  fashion: [
    "fashion", "ootd", "style", "outfitinspo", "fashionreels",
    "streetstyle", "fashiontiktok", "whatiwore", "grwm", "styleinspo",
  ],
  "clothes-store": [
    "boutique", "tiendaderopa", "clothingbrand", "shopsmall",
    "newcollection", "fashionstore", "ropademujer", "outfitoftheday",
  ],
  "hair-salon": [
    "hairstylist", "hairsalon", "hairtransformation", "balayage",
    "haircolor", "peluqueria", "hairstyle", "beforeandafter",
    "blondehair", "haircare",
  ],
  "real-estate": [
    "realestate", "realtor", "luxuryhomes", "househunting",
    "dreamhome", "propertytour", "realestatetiktok", "hometour",
    "bienesinmuebles", "realtorlife",
  ],
};

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
    nichePresets: Object.keys(NICHE_PRESETS),
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
  const { niche, hashtags: customHashtags, clientId, maxResults = 30 } = body;

  if (!niche) {
    return NextResponse.json({ error: "Niche es requerido" }, { status: 400 });
  }

  // Merge preset hashtags with any custom ones
  const presetHashtags = NICHE_PRESETS[niche] || [];
  const hashtags = [
    ...new Set([...presetHashtags, ...(customHashtags || [])]),
  ];

  if (hashtags.length === 0) {
    return NextResponse.json(
      { error: "Se necesita al menos un hashtag" },
      { status: 400 }
    );
  }

  // Create the scan record
  const scan = await prisma.reelScan.create({
    data: {
      agencyId,
      clientId: clientId || null,
      niche,
      hashtags,
      status: "SCRAPING",
    },
  });

  // Run scraping in background (don't await in response)
  runScanPipeline(scan.id, hashtags, niche, maxResults, clientId).catch(
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
  hashtags: string[],
  niche: string,
  maxResults: number,
  clientId?: string
) {
  // Step 1: Scrape from Apify (all content types)
  const rawItems = await scrapeViralContent(hashtags, maxResults);

  // Step 2: Map and save to DB
  const mappedItems = rawItems.map(mapApifyResult);

  // Sort by engagement (likes + comments + shares)
  mappedItems.sort(
    (a, b) =>
      b.likesCount + b.commentsCount + b.sharesCount -
      (a.likesCount + a.commentsCount + a.sharesCount)
  );

  await prisma.reelScan.update({
    where: { id: scanId },
    data: { status: "ANALYZING", totalReels: mappedItems.length },
  });

  // Save content to DB
  for (const item of mappedItems) {
    await prisma.viralReel.create({
      data: {
        scanId,
        ...item,
      },
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
