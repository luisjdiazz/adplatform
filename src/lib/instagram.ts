const META_API_VERSION = "v20.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// Get the Instagram Business Account ID linked to a Facebook Page
export async function getInstagramAccountId(pageAccessToken: string): Promise<string> {
  const res = await fetch(
    `${META_BASE_URL}/me?fields=instagram_business_account&access_token=${pageAccessToken}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API Error: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  if (!data.instagram_business_account?.id) {
    throw new Error("No se encontro cuenta de Instagram Business vinculada");
  }
  return data.instagram_business_account.id;
}

// Get IG account from a Page token — fetches pages first, then IG account
export async function getInstagramAccountFromToken(accessToken: string): Promise<{
  igAccountId: string;
  pageId: string;
  pageAccessToken: string;
}> {
  // Get user's pages
  const pagesRes = await fetch(
    `${META_BASE_URL}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
  );
  if (!pagesRes.ok) {
    const err = await pagesRes.json().catch(() => ({}));
    throw new Error(`Meta API Error: ${err?.error?.message || pagesRes.statusText}`);
  }
  const pagesData = await pagesRes.json();
  const page = pagesData.data?.find((p: any) => p.instagram_business_account?.id);
  if (!page) {
    throw new Error("No se encontro una pagina de Facebook con cuenta de Instagram Business vinculada");
  }
  return {
    igAccountId: page.instagram_business_account.id,
    pageId: page.id,
    pageAccessToken: page.access_token,
  };
}

// Create a media container for an image post
export async function createImageContainer(
  igAccountId: string,
  accessToken: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const res = await fetch(`${META_BASE_URL}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error creando container de imagen: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.id;
}

// Create a media container for a reel/video
export async function createReelContainer(
  igAccountId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
  thumbnailUrl?: string
): Promise<string> {
  const body: Record<string, any> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    access_token: accessToken,
  };
  if (thumbnailUrl) {
    body.cover_url = thumbnailUrl;
  }
  const res = await fetch(`${META_BASE_URL}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error creando container de reel: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data.id;
}

// Check the status of a media container upload
export async function checkContainerStatus(
  containerId: string,
  accessToken: string
): Promise<{ status: string; id: string }> {
  const res = await fetch(
    `${META_BASE_URL}/${containerId}?fields=status_code,status&access_token=${accessToken}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error verificando container: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return { status: data.status_code || data.status, id: data.id };
}

// Publish a media container (makes it live on Instagram)
export async function publishMedia(
  igAccountId: string,
  accessToken: string,
  containerId: string
): Promise<{ id: string }> {
  const res = await fetch(`${META_BASE_URL}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error publicando media: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

// Get permalink of a published post
export async function getMediaPermalink(
  mediaId: string,
  accessToken: string
): Promise<string | null> {
  const res = await fetch(
    `${META_BASE_URL}/${mediaId}?fields=permalink&access_token=${accessToken}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.permalink || null;
}

// Full publish flow: create container → wait for processing → publish
export async function publishPost(
  igAccountId: string,
  accessToken: string,
  fileUrl: string,
  fileType: string,
  caption: string,
  thumbnailUrl?: string
): Promise<{ mediaId: string; permalink: string | null }> {
  // Step 1: Create container
  let containerId: string;
  const isVideo = fileType.startsWith("video/");

  if (isVideo) {
    containerId = await createReelContainer(igAccountId, accessToken, fileUrl, caption, thumbnailUrl);
  } else {
    containerId = await createImageContainer(igAccountId, accessToken, fileUrl, caption);
  }

  // Step 2: Wait for processing (videos need time)
  if (isVideo) {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max
    while (attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 10000)); // 10s intervals
      const status = await checkContainerStatus(containerId, accessToken);
      if (status.status === "FINISHED") break;
      if (status.status === "ERROR") {
        throw new Error("Error procesando video en Instagram");
      }
      attempts++;
    }
    if (attempts >= maxAttempts) {
      throw new Error("Timeout esperando procesamiento de video en Instagram");
    }
  }

  // Step 3: Publish
  const published = await publishMedia(igAccountId, accessToken, containerId);

  // Step 4: Get permalink
  const permalink = await getMediaPermalink(published.id, accessToken);

  return { mediaId: published.id, permalink };
}
