import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInstagramCopyFromImage, generateInstagramCopy } from "@/lib/anthropic";
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
  });

  if (posts.length === 0) {
    return NextResponse.json({ error: "Posts no encontrados" }, { status: 404 });
  }

  const client = posts[0].client;
  const brandProfile = client.brandProfile as Record<string, any> | null;
  const results: any[] = [];
  const generatedCaptions: string[] = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const batchContext = {
      totalPosts: posts.length,
      postIndex: i + 1,
      otherCaptions: generatedCaptions,
    };

    try {
      let aiResult: any;

      if (post.fileType.startsWith("image/")) {
        // For images, download and send to vision API
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
          batchContext
        );
      } else {
        // For videos, use text-based generation with file type info
        aiResult = await generateInstagramCopy(
          `Video/Reel de contenido para ${client.name}. ${brandContext || ""}`,
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

      // Update the post with AI-generated content
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
