/** Cabeceras sin CSP (CSP dinámica vía middleware). */

function baseHeaders() {
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ]
}

function noStoreHeaders() {
  return [
    { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
    { key: 'Pragma', value: 'no-cache' },
    { key: 'Expires', value: '0' },
    { key: 'CDN-Cache-Control', value: 'no-store' },
    { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
    { key: 'Surrogate-Control', value: 'no-store' },
    { key: 'Vary', value: 'Cookie, Authorization' },
  ]
}

function staticAssetCsp() {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ')
}

function staticCacheHeaders() {
  return [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
}

module.exports = {
  buildFullPageHeaders() {
    return [...baseHeaders(), ...noStoreHeaders()]
  },
  buildFullApiHeaders() {
    return [...baseHeaders(), ...noStoreHeaders()]
  },
  buildStaticAssetHeaders() {
    return [
      { key: 'Content-Security-Policy', value: staticAssetCsp() },
      ...baseHeaders(),
      ...staticCacheHeaders(),
    ]
  },
}
