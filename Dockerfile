# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && cp -R node_modules /prod_node_modules
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npx prisma generate
RUN npm run build
# Bundle the autopilot worker into a single file
RUN npx tsx --version > /dev/null 2>&1 || true
RUN npx esbuild workers/autopilot.worker.ts --bundle --platform=node --outfile=worker.js --external:@prisma/client --external:bullmq --external:ioredis

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# FFmpeg is needed for video processing (frame extraction + audio extraction)
RUN apk add --no-cache ffmpeg

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Worker deps (bullmq, ioredis and their subdependencies)
COPY --from=deps /prod_node_modules/bullmq ./node_modules/bullmq
COPY --from=deps /prod_node_modules/ioredis ./node_modules/ioredis
COPY --from=deps /prod_node_modules/cron-parser ./node_modules/cron-parser
COPY --from=deps /prod_node_modules/msgpackr ./node_modules/msgpackr
COPY --from=deps /prod_node_modules/node-abort-controller ./node_modules/node-abort-controller
COPY --from=deps /prod_node_modules/denque ./node_modules/denque
COPY --from=deps /prod_node_modules/lodash ./node_modules/lodash
COPY --from=deps /prod_node_modules/cluster-key-slot ./node_modules/cluster-key-slot
COPY --from=deps /prod_node_modules/standard-as-callback ./node_modules/standard-as-callback
COPY --from=deps /prod_node_modules/redis-errors ./node_modules/redis-errors
COPY --from=deps /prod_node_modules/redis-parser ./node_modules/redis-parser
# fluent-ffmpeg for video processing in API routes
COPY --from=deps /prod_node_modules/fluent-ffmpeg ./node_modules/fluent-ffmpeg
COPY --from=deps /prod_node_modules/which ./node_modules/which
COPY --from=deps /prod_node_modules/isexe ./node_modules/isexe
COPY --from=builder /app/worker.js ./worker.js
COPY --from=builder /app/start.sh ./start.sh
RUN chmod +x start.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "start.sh"]
