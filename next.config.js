/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['bullmq', 'ioredis'],
  },
};

module.exports = nextConfig;
