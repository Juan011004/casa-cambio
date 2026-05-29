export { API_BASE_HEADERS, BASE_SECURITY_HEADERS, NO_STORE_HEADERS, STATIC_ASSET_HEADERS, isStaticAssetPath } from '@/lib/security-header-constants'

import { API_BASE_HEADERS } from '@/lib/security-header-constants'

export function applyApiSecurityHeaders(headers: Headers) {
  const acao = headers.get('Access-Control-Allow-Origin')
  if (acao === '*' || acao === '*, *') {
    headers.delete('Access-Control-Allow-Origin')
  }
  headers.delete('Access-Control-Allow-Credentials')
  for (const { key, value } of API_BASE_HEADERS) {
    headers.set(key, value)
  }
}
