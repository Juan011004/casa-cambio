/** @type {import('next').NextConfig} */
const {
  buildFullPageHeaders,
  buildFullApiHeaders,
  buildStaticAssetHeaders,
} = require('./lib/next-config-headers.js')

const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  swcMinify: true,
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: buildStaticAssetHeaders(),
      },
      {
        source: '/api/:path*',
        headers: buildFullApiHeaders(),
      },
      {
        source: '/:path*',
        headers: buildFullPageHeaders(),
      },
    ]
  },
}

module.exports = nextConfig
