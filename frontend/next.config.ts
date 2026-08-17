import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-fe2eb5b1b6b1482e90b48fd5b04cc7c3.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.cloudflarestorage.com',
      },
    ],
  },
}

export default nextConfig