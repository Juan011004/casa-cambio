import { applyApiSecurityHeaders } from '@/lib/security-headers'
import { NextResponse } from 'next/server'

export function jsonWithSecurity<T>(body: T, init?: ResponseInit) {
  const res = NextResponse.json(body, init)
  applyApiSecurityHeaders(res.headers)
  return res
}
