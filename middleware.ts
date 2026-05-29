import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  API_SECURITY_HEADERS,
  NO_STORE_HEADERS,
  SECURITY_HEADERS,
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
}

function setHeaderList(headers: Headers, list: ReadonlyArray<{ key: string; value: string }>) {
  for (const { key, value } of list) {
    headers.set(key, value)
  }
}

function applyPageSecurityHeaders(headers: Headers) {
  stripPermissiveCors(headers)
  setHeaderList(headers, SECURITY_HEADERS)
  setHeaderList(headers, NO_STORE_HEADERS)
}

function applyApiSecurityHeaders(headers: Headers) {
  stripPermissiveCors(headers)
  setHeaderList(headers, API_SECURITY_HEADERS)
}

function withSecurityHeaders(response: NextResponse, options?: { api?: boolean }) {
  if (options?.api) applyApiSecurityHeaders(response.headers)
  else applyPageSecurityHeaders(response.headers)
  return response
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const ip = clientIp(req)
  const isApi = pathname.startsWith('/api/')

  if (isApi) {
    if (!checkRateLimit(`api:${ip}`)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 }),
        { api: true }
      )
    }
  }

  const res = withSecurityHeaders(NextResponse.next())

  if (req.method === 'POST' && req.headers.get('next-action')) {
    if (!checkRateLimit(`action:${ip}`)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 }),
        { api: true }
      )
    }
  }

  if (pathname.startsWith('/api/trm-update')) {
    return withSecurityHeaders(res, { api: true })
  }

  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLogin = pathname === '/login'
  const isAuthSync = pathname === '/api/auth/sync'

  if (isAuthSync) {
    return withSecurityHeaders(res, { api: true })
  }

  if (user && isLogin) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return withSecurityHeaders(NextResponse.redirect(url))
  }

  if (!user && !isLogin) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return withSecurityHeaders(NextResponse.redirect(url))
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
