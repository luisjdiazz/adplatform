const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_BASE_URL = "https://api.apify.com/v2";

// Using apify/instagram-scraper — supports posts, reels, carousels
const ACTOR_ID = "apify~instagram-scraper";

export type ContentType = "REEL" | "POST" | "CAROUSEL";

interface ApifyResult {
  // Common fields
  url?: string;
  shortCode?: string;
  ownerUsername?: string;
  ownerFullName?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoPlayCount?: number;
  videoViewCount?: number;
  shareCount?: number;
  // Type detection
  type?: string; // "Image", "Video", "Sidecar" (carousel)
  productType?: string; // "clips" = reel, "feed" = post, "carousel_container"
  isVideo?: boolean;
  // Media
  displayUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  images?: string[];
  childPosts?: { displayUrl?: string; videoUrl?: string; isVideo?: boolean }[];
  sidecarImages?: { displayUrl?: string }[];
  // Video-specific
  videoDuration?: number;
  musicInfo?: { artist_name?: string; song_name?: string; title?: string };
  // Metadata
  hashtags?: string[];
  timestamp?: string;
  dimensionsHeight?: number;
  dimensionsWidth?: number;
}

function detectContentType(item: ApifyResult): ContentType {
  // Sidecar = carousel
  if (
    item.type === "Sidecar" ||
    item.productType === "carousel_container" ||
    (item.childPosts && item.childPosts.length > 1) ||
    (item.sidecarImages && item.sidecarImages.length > 1)
  ) {
    return "CAROUSEL";
  }
  // Clips = reel
  if (
    item.productType === "clips" ||
    item.type === "Video" ||
    item.isVideo
  ) {
    return "REEL";
  }
  return "POST";
}

function extractMediaUrls(item: ApifyResult): string[] {
  const urls: string[] = [];

  // Carousel images
  if (item.childPosts?.length) {
    for (const child of item.childPosts) {
      if (child.displayUrl) urls.push(child.displayUrl);
    }
  }
  if (item.sidecarImages?.length) {
    for (const img of item.sidecarImages) {
      if (img.displayUrl) urls.push(img.displayUrl);
    }
  }
  if (item.images?.length) {
    urls.push(...item.images);
  }

  // Main image/thumbnail
  if (urls.length === 0 && item.displayUrl) {
    urls.push(item.displayUrl);
  }

  return urls;
}

export async function scrapeViralContent(
  hashtags: string[],
  maxResults: number = 30
): Promise<ApifyResult[]> {
  if (!APIFY_API_TOKEN) {
    throw new Error("APIFY_API_TOKEN no esta configurado");
  }

  // Build hashtag explore URLs
  const directUrls = hashtags.map(
    (tag) =>
      `https://www.instagram.com/explore/tags/${tag.replace("#", "").trim()}/`
  );

  const input = {
    directUrls,
    resultsType: "posts",
    resultsLimit: maxResults,
    searchType: "hashtag",
    searchLimit: maxResults,
    addParentData: false,
  };

  // Start the actor run
  const runResponse = await fetch(
    `${APIFY_BASE_URL}/acts/${encodeURIComponent(ACTOR_ID)}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const err = await runResponse.text();
    throw new Error(`Error al iniciar actor de Apify: ${err}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data?.id;
  if (!runId) throw new Error("No se obtuvo runId de Apify");

  // Poll for completion (max 8 minutes for larger scrapes)
  const maxWait = 8 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, 5000));

    const statusRes = await fetch(
      `${APIFY_BASE_URL}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );
    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED") {
      throw new Error(`Actor de Apify fallo con status: ${status}`);
    }
  }

  // Fetch results
  const datasetRes = await fetch(
    `${APIFY_BASE_URL}/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&format=json`
  );

  if (!datasetRes.ok) {
    throw new Error("Error al obtener resultados del dataset de Apify");
  }

  const items: ApifyResult[] = await datasetRes.json();
  return items;
}

// Map Apify results to our DB format
export function mapApifyResult(item: ApifyResult) {
  const contentType = detectContentType(item);
  const mediaUrls = extractMediaUrls(item);

  return {
    contentType,
    instagramUrl: item.url || "",
    shortcode: item.shortCode || null,
    ownerUsername: item.ownerUsername || null,
    ownerFullName: item.ownerFullName || null,
    caption: item.caption || null,
    likesCount: item.likesCount || 0,
    commentsCount: item.commentsCount || 0,
    viewsCount: item.videoPlayCount || item.videoViewCount || 0,
    sharesCount: item.shareCount || 0,
    duration: item.videoDuration || null,
    thumbnailUrl: item.displayUrl || item.thumbnailUrl || null,
    mediaUrls,
    musicName: item.musicInfo
      ? item.musicInfo.song_name || item.musicInfo.title || item.musicInfo.artist_name || null
      : null,
    hashtags: item.hashtags || [],
    postedAt: item.timestamp ? new Date(item.timestamp) : null,
  };
}

// Keep backward-compatible exports
export const scrapeViralReels = scrapeViralContent;
export const mapApifyReel = mapApifyResult;
