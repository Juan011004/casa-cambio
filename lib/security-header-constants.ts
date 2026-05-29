import { buildApiCsp, buildStaticAssetCsp } from '@/lib/csp'

/** Cabeceras sin CSP (CSP se aplica por petición en middleware). */
export const BASE_SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
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

export const STATIC_ASSET_CACHE_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
]

export const STATIC_ASSET_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Content-Security-Policy', value: buildStaticAssetCsp() },
  ...BASE_SECURITY_HEADERS,
  ...STATIC_ASSET_CACHE_HEADERS,
]

export const API_BASE_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: 'Content-Security-Policy', value: buildApiCsp() },
  ...BASE_SECURITY_HEADERS,
  ...NO_STORE_HEADERS,
]

export function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/chunks/')
}
