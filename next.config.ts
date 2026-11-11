import type { NextConfig } from 'next'
import { parseServerEnv } from './config/env/parse-server-env'
import { statusImageSources } from './lib/common/status-image-sources'

parseServerEnv()

const nextConfig: NextConfig = {
  async headers() {
    return Object.values(statusImageSources).map(source => ({
      source,
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }))
  },
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  reactStrictMode: false,
  reactCompiler: true,
  experimental: {
    // 'lucide-react' is default. https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
    turbopackRustReactCompiler: true,
  },
}

export default nextConfig
