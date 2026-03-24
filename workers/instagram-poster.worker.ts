import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { getInstagramAccountFromToken, publishPost } from "../src/lib/instagram";
import { getSignedDownloadUrl } from "../src/lib/storage";

const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6380";

async function processScheduledPosts() {
  console.log("[Instagram Poster] Checking for scheduled posts...");

  const now = new Date();

  // Find all posts that are SCHEDULED and due now (or overdue within last 30 min)
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

  const duePosts = await prisma.scheduledPost.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: {
        lte: now,
        gte: thirtyMinAgo,
      },
      caption: { not: null },
    },
    include: {
      client: {
        include: { metaAccounts: true },
      },
    },
  });

  console.log(`[Instagram Poster] Found ${duePosts.length} posts due for publishing`);

  for (const post of duePosts) {
    const metaAccount = post.client.metaAccounts[0];
    if (!metaAccount) {
      console.log(`[Instagram Poster] Skipping post ${post.id} — no Meta account for client ${post.client.name}`);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "FAILED",
          errorMessage: "No hay cuenta de Meta conectada",
        },
      });
      continue;
    }

    // Mark as publishing
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: "PUBLISHING" },
    });

    try {
      console.log(`[Instagram Poster] Publishing post ${post.id} for ${post.client.name}...`);

      // Get Instagram account
      const { igAccountId, pageAccessToken } = await getInstagramAccountFromToken(metaAccount.accessToken);

      // Get a public URL for the file
      const fileUrl = await getSignedDownloadUrl(post.fileKey);

      // Publish
      const result = await publishPost(
        igAccountId,
        pageAccessToken,
        fileUrl,
        post.fileType,
        post.caption!,
        post.thumbnailUrl || undefined
      );

      // Update with success
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "POSTED",
          publishedAt: new Date(),
          igMediaId: result.mediaId,
          igPermalink: result.permalink,
        },
      });

      console.log(`[Instagram Poster] Successfully published post ${post.id}: ${result.permalink}`);
    } catch (err: any) {
      console.error(`[Instagram Poster] Failed to publish post ${post.id}:`, err.message);

      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "FAILED",
          errorMessage: err.message,
        },
      });
    }
  }
}

// Worker that runs the check on a schedule
const worker = new Worker(
  "instagram-poster",
  async (job: Job) => {
    await processScheduledPosts();
  },
  {
    connection: { url: REDIS_URL, lazyConnect: true } as any,
  }
);

worker.on("completed", (job) => {
  console.log(`[Instagram Poster] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[Instagram Poster] Job ${job?.id} failed:`, err.message);
});

console.log("[Instagram Poster] Worker started. Listening for jobs...");

// Also run a periodic check every 5 minutes
setInterval(async () => {
  try {
    await processScheduledPosts();
  } catch (err: any) {
    console.error("[Instagram Poster] Periodic check failed:", err.message);
  }
}, 5 * 60 * 1000);

// Run once on start
processScheduledPosts().catch(console.error);
