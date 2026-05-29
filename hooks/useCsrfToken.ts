'use client'

import { useEffect, useState } from 'react'
import { CSRF_COOKIE } from '@/lib/csrf'

function readCsrfCookie(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

export function useCsrfToken(initial = ''): string {
  const [token, setToken] = useState(initial)

  useEffect(() => {
    const fromCookie = readCsrfCookie()
    if (fromCookie) setToken(fromCookie)
  }, [initial])

  return token || initial
}
