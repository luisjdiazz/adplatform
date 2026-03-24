import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return connection;
}

function createQueue(name: string) {
  return new Queue(name, {
    connection: {
      url: process.env.REDIS_URL || "redis://localhost:6380",
      lazyConnect: true,
    } as any,
  });
}

let _autopilotQueue: Queue | null = null;
let _metaSyncQueue: Queue | null = null;
let _whatsappQueue: Queue | null = null;
let _instagramPosterQueue: Queue | null = null;

export function getAutopilotQueue() {
  if (!_autopilotQueue) _autopilotQueue = createQueue("autopilot");
  return _autopilotQueue;
}

export function getMetaSyncQueue() {
  if (!_metaSyncQueue) _metaSyncQueue = createQueue("meta-sync");
  return _metaSyncQueue;
}

export function getWhatsappQueue() {
  if (!_whatsappQueue) _whatsappQueue = createQueue("whatsapp");
  return _whatsappQueue;
}

export function getInstagramPosterQueue() {
  if (!_instagramPosterQueue) _instagramPosterQueue = createQueue("instagram-poster");
  return _instagramPosterQueue;
}
