'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { clearServerSessionCookies, syncServerSessionFromClient } from '@/lib/auth/sync-server-session'

const PUBLIC_ROUTES = ['/login']

function hasSupabaseSessionInStorage(): boolean {
  if (typeof window === 'undefined') return false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return false
  try {
    const ref = new URL(url).hostname.split('.')[0]
    const key = `sb-${ref}-auth-token`
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { access_token?: string }
    return Boolean(parsed?.access_token)
  } catch {
    return false
  }
}

export function SessionSecurityProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const signingOutRef = useRef(false)

  const redirectToLoginIfNeeded = async () => {
    if (PUBLIC_ROUTES.includes(pathname)) return
    if (!hasSupabaseSessionInStorage()) {
      router.replace('/login')
      return
    }
    const supabase = createBrowserSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.replace('/login')
    }
  }

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session) void syncServerSessionFromClient()
      }
      if (event === 'SIGNED_OUT') {
        void clearServerSessionCookies()
      }
    })

    void syncServerSessionFromClient()
    void redirectToLoginIfNeeded()

    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) void redirectToLoginIfNeeded()
    }

    const onPopState = () => {
      void redirectToLoginIfNeeded()
    }

    const onBeforeUnload = () => {
      if (signingOutRef.current) return
      signingOutRef.current = true
      void supabase.auth.signOut()
      fetch('/api/auth/sync', { method: 'DELETE', credentials: 'same-origin', keepalive: true }).catch(() => {})
    }

    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('popstate', onPopState)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathname drives guard
  }, [pathname])

  return <>{children}</>
}
