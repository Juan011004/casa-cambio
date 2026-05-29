const SUPABASE_CONNECT = 'https://*.supabase.co wss://*.supabase.co'

/** CSP estricta con nonce por petición (HTML / Next.js App Router). */
export function buildPageCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE_CONNECT}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ')
}

/** CSP para chunks estáticos (sin unsafe-inline / unsafe-eval). */
export function buildStaticAssetCsp(): string {
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

/** CSP para respuestas JSON de API. */
export function buildApiCsp(): string {
  return [
    "default-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64')
}
