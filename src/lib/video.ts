import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export interface VideoProcessingResult {
  frames: { buffer: Buffer; index: number }[];
  audio: Buffer | null;
  duration: number;
}

/**
 * Process a video file: extract key frames and audio track.
 * Requires FFmpeg to be installed on the system.
 */
export async function processVideo(
  inputBuffer: Buffer,
  filename: string
): Promise<VideoProcessingResult> {
  const workDir = join(tmpdir(), `adplatform-video-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  const inputPath = join(workDir, filename);
  await fs.writeFile(inputPath, inputBuffer);

  try {
    const duration = await getVideoDuration(inputPath);
    const [frames, audio] = await Promise.all([
      extractFrames(inputPath, workDir, duration),
      extractAudio(inputPath, workDir),
    ]);

    return { frames, audio, duration };
  } finally {
    // Clean up temp files
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function getVideoDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

function extractFrames(
  inputPath: string,
  workDir: string,
  duration: number
): Promise<{ buffer: Buffer; index: number }[]> {
  // Extract up to 4 evenly-spaced frames
  const frameCount = Math.min(4, Math.max(1, Math.floor(duration)));
  const interval = duration / (frameCount + 1);
  const timestamps = Array.from({ length: frameCount }, (_, i) =>
    Math.round((i + 1) * interval * 100) / 100
  );

  const framePromises = timestamps.map(
    (ts, index) =>
      new Promise<{ buffer: Buffer; index: number }>((resolve, reject) => {
        const outputPath = join(workDir, `frame-${index}.jpg`);
        ffmpeg(inputPath)
          .seekInput(ts)
          .frames(1)
          .outputOptions(["-vf", "scale=720:-2", "-q:v", "3"])
          .output(outputPath)
          .on("end", async () => {
            try {
              const buffer = await fs.readFile(outputPath);
              resolve({ buffer, index });
            } catch (e) {
              reject(e);
            }
          })
          .on("error", reject)
          .run();
      })
  );

  return Promise.all(framePromises);
}

function extractAudio(
  inputPath: string,
  workDir: string
): Promise<Buffer | null> {
  const outputPath = join(workDir, "audio.mp3");

  return new Promise((resolve) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate("64k")
      .audioChannels(1)
      .audioFrequency(16000)
      .output(outputPath)
      .on("end", async () => {
        try {
          const buffer = await fs.readFile(outputPath);
          // Skip if audio is too small (likely silence/no audio track)
          if (buffer.length < 1000) {
            resolve(null);
          } else {
            resolve(buffer);
          }
        } catch {
          resolve(null);
        }
      })
      .on("error", () => {
        // Video might have no audio track
        resolve(null);
      })
      .run();
  });
}
