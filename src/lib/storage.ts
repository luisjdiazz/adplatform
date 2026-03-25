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

  // Store the key as the fileUrl — we generate presigned URLs on read
  return `r2://${key}`;
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 86400 }); // 24h
}

/** Extract the R2 key from any fileUrl format */
export function extractR2Key(fileUrl: string): string | null {
  // Format: r2://key (new format)
  if (fileUrl.startsWith("r2://")) return fileUrl.slice(5);
  // Format: /api/files/key (proxy format)
  if (fileUrl.startsWith("/api/files/")) return fileUrl.slice(11);
  // Format: https://bucket.accountid.r2.cloudflarestorage.com/key
  const r2Match = fileUrl.match(/r2\.cloudflarestorage\.com\/(.+)$/);
  if (r2Match) return r2Match[1];
  // Format: https://custom.domain.com/key
  if (process.env.R2_PUBLIC_URL && fileUrl.startsWith(process.env.R2_PUBLIC_URL)) {
    return fileUrl.slice(process.env.R2_PUBLIC_URL.length + 1);
  }
  return null;
}

/** Generate a presigned URL for a fileUrl (any format) */
export async function toPresignedUrl(fileUrl: string): Promise<string> {
  const key = extractR2Key(fileUrl);
  if (!key) return fileUrl; // not an R2 URL, return as-is
  return getSignedDownloadUrl(key);
}
