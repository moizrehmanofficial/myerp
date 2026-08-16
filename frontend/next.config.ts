import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return []
  },
  devIndicators: false,
}

export default nextConfig