import { API_BASE_HEADERS } from '@/lib/security-header-constants'
import { NextResponse } from 'next/server'

function applyApiSecurityHeaders(headers: Headers) {
  headers.delete('Access-Control-Allow-Origin')
  headers.delete('Access-Control-Allow-Credentials')
  for (const { key, value } of API_BASE_HEADERS) {
    headers.set(key, value)
  }
}

export function jsonWithSecurity<T>(body: T, init?: ResponseInit) {
  const res = NextResponse.json(body, init)
  applyApiSecurityHeaders(res.headers)
  return res
}
