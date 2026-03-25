import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "adplatform-uploads";

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Always use the proxy URL so files load in the browser without CORS issues
  return `/api/files/${key}`;
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

/** Convert any existing R2 URL to proxy URL */
export function toProxyUrl(fileUrl: string): string {
  if (fileUrl.startsWith("/api/files/")) return fileUrl;
  // Extract key from R2 URLs like https://bucket.accountid.r2.cloudflarestorage.com/key
  const r2Match = fileUrl.match(/r2\.cloudflarestorage\.com\/(.+)$/);
  if (r2Match) return `/api/files/${r2Match[1]}`;
  // Extract key from custom domain URLs like https://custom.domain.com/key
  if (process.env.R2_PUBLIC_URL && fileUrl.startsWith(process.env.R2_PUBLIC_URL)) {
    const key = fileUrl.slice(process.env.R2_PUBLIC_URL.length + 1);
    return `/api/files/${key}`;
  }
  return fileUrl;
}
