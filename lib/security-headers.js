/** Cabeceras OWASP ZAP — fuente única (next.config.js + vercel.json + middleware). */

function supabaseConnectSources() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!url) return 'https://*.supabase.co wss://*.supabase.co'
  try {
    const host = new URL(url).host
    return `https://${host} wss://${host}`
  } catch {
    return 'https://*.supabase.co wss://*.supabase.co'
  }
}

function buildContentSecurityPolicy() {
  const connect = supabaseConnectSources()
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${connect}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

function buildSecurityHeaders() {
  const headers = [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy() },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ]

  if (process.env.NODE_ENV === 'production') {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    })
  }

  return headers
}

function buildNoStoreHeaders() {
  return [
    { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
    { key: 'Pragma', value: 'no-cache' },
    { key: 'Expires', value: '0' },
    { key: 'CDN-Cache-Control', value: 'no-store' },
    { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
    { key: 'Surrogate-Control', value: 'no-store' },
  ]
}

function buildApiHeaders() {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Cache-Control', value: 'no-store' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ]
}

/** Rutas HTML dinámicas (excluye estáticos de Next). */
const HTML_SOURCE =
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'

module.exports = {
  HTML_SOURCE,
  buildSecurityHeaders,
  buildNoStoreHeaders,
  buildApiHeaders,
  buildHtmlHeaders() {
    return [...buildSecurityHeaders(), ...buildNoStoreHeaders()]
  },
}
