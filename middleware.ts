import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildPageCsp, generateNonce } from '@/lib/csp'
import { CSRF_COOKIE, csrfCookieOptions, generateCsrfToken } from '@/lib/csrf'
import {
  API_BASE_HEADERS,
  BASE_SECURITY_HEADERS,
  NO_STORE_HEADERS,
  STATIC_ASSET_HEADERS,
  isStaticAssetPath,
} from '@/lib/security-header-constants'

function clientIp(req: NextRequest): string {
  return (
    req.ip ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function stripPermissiveCors(headers: Headers) {
  headers.delete('Access-Control-Allow-Origin')
  headers.delete('Access-Control-Allow-Credentials')
  headers.delete('Access-Control-Allow-Methods')
  headers.delete('Access-Control-Allow-Headers')
  headers.delete('Access-Control-Expose-Headers')
}

function setHeaderList(headers: Headers, list: ReadonlyArray<{ key: string; value: string }>) {
  for (const { key, value } of list) {
    headers.set(key, value)
  }
}

type HeaderMode = 'page' | 'api' | 'static'

function applyHeaders(
  headers: Headers,
  mode: HeaderMode,
  options?: { nonce?: string }
) {
  stripPermissiveCors(headers)
  if (mode === 'static') {
    setHeaderList(headers, STATIC_ASSET_HEADERS)
    return
  }
  if (mode === 'api') {
    setHeaderList(headers, API_BASE_HEADERS)
    return
  }
  if (options?.nonce) {
    headers.set('Content-Security-Policy', buildPageCsp(options.nonce))
  }
  setHeaderList(headers, BASE_SECURITY_HEADERS)
  setHeaderList(headers, NO_STORE_HEADERS)
}

function createPageResponse(req: NextRequest): NextResponse {
  const nonce = generateNonce()
  const csp = buildPageCsp(nonce)
  const existing = req.cookies.get(CSRF_COOKIE)?.value
  const csrfToken =
    existing && existing.length >= 32 ? existing : generateCsrfToken()

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  requestHeaders.set('x-csrf-token', csrfToken)

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  })

  if (!existing || existing.length < 32) {
    res.cookies.set(CSRF_COOKIE, csrfToken, csrfCookieOptions(process.env.NODE_ENV === 'production'))
  }

  applyHeaders(res.headers, 'page', { nonce })
  return res
}

function withHeaders(response: NextResponse, mode: HeaderMode, nonce?: string) {
  applyHeaders(response.headers, mode, mode === 'page' ? { nonce } : undefined)
  return response
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const ip = clientIp(req)
  const isApi = pathname.startsWith('/api/')
  const isStatic = isStaticAssetPath(pathname)

  if (isApi && !checkRateLimit(`api:${ip}`)) {
    return withHeaders(
      NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 }),
      'api'
    )
  }

  if (isStatic) {
    const res = NextResponse.next()
    applyHeaders(res.headers, 'static')
    return res
  }

  if (isApi) {
    const res = NextResponse.next()
    applyHeaders(res.headers, 'api')
    return res
  }

  const res = createPageResponse(req)

  if (req.method === 'POST' && req.headers.get('next-action')) {
    if (!checkRateLimit(`action:${ip}`)) {
      return withHeaders(
        NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 }),
        'api'
      )
    }
  }

  if (pathname.startsWith('/api/trm-update')) {
    return res
  }

  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLogin = pathname === '/login'
  const isAuthSync = pathname === '/api/auth/sync'

  if (isAuthSync) {
    return res
  }

  if (user && isLogin) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirect = NextResponse.redirect(url)
    const nonce = generateNonce()
    applyHeaders(redirect.headers, 'page', { nonce })
    return redirect
  }

  if (!user && !isLogin && !isApi) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    const nonce = generateNonce()
    applyHeaders(redirect.headers, 'page', { nonce })
    return redirect
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
