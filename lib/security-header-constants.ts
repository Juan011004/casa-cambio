/**
 * Cabeceras estáticas para middleware (Edge) y referencia compartida.
 * ZAP exige CSP/HSTS/XFO también en chunks de Next (`/_next/static/*`).
 */

export const CORE_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
  },
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

export const NO_STORE_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
  { key: 'CDN-Cache-Control', value: 'no-store' },
  { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
  { key: 'Surrogate-Control', value: 'no-store' },
]

/** Chunks estáticos: cabeceras de seguridad + caché explícita (evita alerta 10015 en assets). */
export const STATIC_ASSET_CACHE_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
]

/** Compatibilidad con imports anteriores. */
export const SECURITY_HEADERS = CORE_SECURITY_HEADERS

export const FULL_PAGE_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  ...CORE_SECURITY_HEADERS,
  ...NO_STORE_HEADERS,
]

export const FULL_API_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  ...CORE_SECURITY_HEADERS,
  ...NO_STORE_HEADERS,
]

export const STATIC_ASSET_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  ...CORE_SECURITY_HEADERS,
  ...STATIC_ASSET_CACHE_HEADERS,
]

export function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/chunks/')
}
