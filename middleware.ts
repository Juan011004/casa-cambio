import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

function clientIp(req: NextRequest): string {
  return (
    req.ip ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  const ip = clientIp(req)

  if (pathname.startsWith('/api/')) {
    if (!checkRateLimit(`api:${ip}`)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 })
    }
  }

  if (req.method === 'POST' && req.headers.get('next-action')) {
    if (!checkRateLimit(`action:${ip}`)) {
      return NextResponse.json({ error: 'Demasiadas solicitudes. Espere unos segundos.' }, { status: 429 })
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
    return NextResponse.redirect(url)
  }

  if (!user && !isLogin) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    const redirect = NextResponse.redirect(url)
    redirect.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return redirect
  }

  if (!isLogin) {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
