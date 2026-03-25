import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInstagramCopyFromImage, generateInstagramCopy, generateCarouselCopy } from "@/lib/anthropic";
import { getSignedDownloadUrl } from "@/lib/storage";

// POST /api/content-scheduler/generate-copy — Generate AI copy for posts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { postIds, brandContext } = await req.json();
  if (!postIds?.length) {
    return NextResponse.json({ error: "postIds requerido" }, { status: 400 });
  }

  const posts = await prisma.scheduledPost.findMany({
    where: { id: { in: postIds } },
    include: { client: true },
    orderBy: { carouselOrder: "asc" },
  });

  if (posts.length === 0) {
    return NextResponse.json({ error: "Posts no encontrados" }, { status: 404 });
  }

  const client = posts[0].client;
  const brandProfile = client.brandProfile as Record<string, any> | null;
  const results: any[] = [];
  const generatedCaptions: string[] = [];

  // Group carousel posts together
  const carouselGroups = new Map<string, typeof posts>();
  const nonCarouselPosts: typeof posts = [];

  for (const post of posts) {
    if (post.postType === "CAROUSEL" && post.carouselGroupId) {
      const group = carouselGroups.get(post.carouselGroupId) || [];
      group.push(post);
      carouselGroups.set(post.carouselGroupId, group);
    } else {
      nonCarouselPosts.push(post);
    }
  }

  // Process carousel groups — generate ONE copy per carousel with all images
  for (const [groupId, groupPosts] of carouselGroups) {
    const sortedPosts = groupPosts.sort((a, b) => (a.carouselOrder ?? 0) - (b.carouselOrder ?? 0));
    const userContext = sortedPosts[0]?.userContext || "";
    const batchContext = {
      totalPosts: nonCarouselPosts.length + carouselGroups.size,
      postIndex: generatedCaptions.length + 1,
      otherCaptions: generatedCaptions,
    };

    try {
      // Download all images for the carousel
      const images: { base64: string; mediaType: string }[] = [];
      for (const post of sortedPosts) {
        if (post.fileType.startsWith("image/")) {
          const signedUrl = await getSignedDownloadUrl(post.fileKey);
          const imageRes = await fetch(signedUrl);
          const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
          images.push({
            base64: imageBuffer.toString("base64"),
            mediaType: post.fileType,
          });
        }
      }

      const aiResult = await generateCarouselCopy(
        images,
        brandProfile || undefined,
        brandContext,
        userContext,
        batchContext
      );

      const fullCaption = aiResult.caption +
        (aiResult.engagement_prompt ? `\n\n${aiResult.engagement_prompt}` : "") +
        "\n\n" +
        aiResult.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ");

      // Update ALL posts in the carousel with the same caption
      for (const post of sortedPosts) {
        const updated = await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            caption: fullCaption,
            hashtags: aiResult.hashtags,
            aiAnalysis: aiResult,
          },
        });
        results.push({ postId: post.id, success: true, aiResult, post: updated });
      }
      generatedCaptions.push(aiResult.caption);
    } catch (err: any) {
      for (const post of sortedPosts) {
        results.push({ postId: post.id, success: false, error: err.message });
      }
    }
  }

  // Process non-carousel posts
  for (let i = 0; i < nonCarouselPosts.length; i++) {
    const post = nonCarouselPosts[i];
    const batchContext = {
      totalPosts: nonCarouselPosts.length + carouselGroups.size,
      postIndex: generatedCaptions.length + 1,
      otherCaptions: generatedCaptions,
    };

    const userContext = post.userContext || "";

    try {
      let aiResult: any;

      if (post.fileType.startsWith("image/")) {
        const signedUrl = await getSignedDownloadUrl(post.fileKey);
        const imageRes = await fetch(signedUrl);
        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
        const base64 = imageBuffer.toString("base64");
        const mediaType = post.fileType as "image/jpeg" | "image/png" | "image/webp";

        aiResult = await generateInstagramCopyFromImage(
          base64,
          mediaType,
          brandProfile || undefined,
          brandContext,
          batchContext,
          userContext
        );
      } else {
        // For videos/reels: use text-based generation with user context
        const videoDescription = [
          `Video/Reel de contenido para ${client.name}.`,
          userContext ? `Descripcion del video: ${userContext}` : "",
          brandContext ? `Contexto de marca: ${brandContext}` : "",
        ].filter(Boolean).join(" ");

        aiResult = await generateInstagramCopy(
          videoDescription,
          post.fileType,
          brandProfile || undefined,
          brandContext,
          batchContext
        );
      }

      const fullCaption = aiResult.caption +
        (aiResult.engagement_prompt ? `\n\n${aiResult.engagement_prompt}` : "") +
        "\n\n" +
        aiResult.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ");

      const updated = await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          caption: fullCaption,
          hashtags: aiResult.hashtags,
          aiAnalysis: aiResult,
        },
      });

      generatedCaptions.push(aiResult.caption);
      results.push({ postId: post.id, success: true, aiResult, post: updated });
    } catch (err: any) {
      results.push({ postId: post.id, success: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}
