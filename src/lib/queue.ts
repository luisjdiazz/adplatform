import { Queue } from "bullmq";
import IORedis from "ioredis";

let connection: IORedis | null = null;

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6380", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export const autopilotQueue = new Queue("autopilot", {
  connection: getRedisConnection() as any,
});

export const metaSyncQueue = new Queue("meta-sync", {
  connection: getRedisConnection() as any,
});

export const whatsappQueue = new Queue("whatsapp", {
  connection: getRedisConnection() as any,
});
