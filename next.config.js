/** @type {import('next').NextConfig} */
const { HTML_SOURCE, buildHtmlHeaders, buildApiHeaders } = require('./lib/security-headers.js')

const nextConfig = {
  async headers() {
    return [
      {
        source: HTML_SOURCE,
        headers: buildHtmlHeaders(),
      },
      {
        source: '/api/:path*',
        headers: buildApiHeaders(),
      },
    ]
  },
}

module.exports = nextConfig
