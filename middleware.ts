import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  FULL_API_HEADERS,
  FULL_PAGE_HEADERS,
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
  const acao = headers.get('Access-Control-Allow-Origin')
  if (acao === '*' || acao === '*, *') {
    headers.delete('Access-Control-Allow-Origin')
  }
  headers.delete('Access-Control-Allow-Credentials')
  headers.delete('Access-Control-Allow-Methods')
  headers.delete('Access-Control-Allow-Headers')
}

function setHeaderList(headers: Headers, list: ReadonlyArray<{ key: string; value: string }>) {
  for (const { key, value } of list) {
    headers.set(key, value)
  }
}

function applySecurityHeaders(headers: Headers, pathname: string, mode: 'page' | 'api' | 'static') {
  stripPermissiveCors(headers)
  if (mode === 'static' || isStaticAssetPath(pathname)) {
    setHeaderList(headers, STATIC_ASSET_HEADERS)
  } else if (mode === 'api') {
    setHeaderList(headers, FULL_API_HEADERS)
  } else {
    setHeaderList(headers, FULL_PAGE_HEADERS)
  }
}

function withSecurityHeaders(
  response: NextResponse,
  pathname: string,
  mode: 'page' | 'api' | 'static' = 'page'
) {
  applySecurityHeaders(response.headers, pathname, mode)
  return response
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const ip = clientIp(req)
  const isApi = pathname.startsWith('/api/')
  const isStatic = isStaticAssetPath(pathname)
  const headerMode: 'page' | 'api' | 'static' = isApi ? 'api' : isStatic ? 'static' : 'page'

  if (isApi && !checkRateLimit(`api:${ip}`)) {
    return withSecurityHeaders(
      NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 }),
      pathname,
      'api'
    )
  }

  const res = withSecurityHeaders(NextResponse.next(), pathname, headerMode)

  if (req.method === 'POST' && req.headers.get('next-action')) {
    if (!checkRateLimit(`action:${ip}`)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 }),
        pathname,
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

  if (isStatic) {
    return res
  }

  if (user && isLogin) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return withSecurityHeaders(NextResponse.redirect(url), '/dashboard', 'page')
  }

  if (!user && !isLogin && !isApi) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return withSecurityHeaders(NextResponse.redirect(url), '/login', 'page')
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
