import { cookies, headers } from 'next/headers'
import { CSRF_COOKIE } from '@/lib/csrf'

export function getServerCsrfToken(): string {
  const fromHeader = headers().get('x-csrf-token')
  if (fromHeader) return fromHeader
  return cookies().get(CSRF_COOKIE)?.value ?? ''
}
