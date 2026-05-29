export const CSRF_COOKIE = 'cc_csrf'
export const CSRF_FORM_FIELD = '_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function csrfCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: 'strict' as const,
    secure,
    path: '/',
    maxAge: 60 * 60 * 8,
  }
}
