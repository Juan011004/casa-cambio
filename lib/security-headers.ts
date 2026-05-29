export {
  CORE_SECURITY_HEADERS,
  FULL_API_HEADERS,
  FULL_PAGE_HEADERS,
  NO_STORE_HEADERS,
  SECURITY_HEADERS,
  STATIC_ASSET_HEADERS,
  isStaticAssetPath,
} from '@/lib/security-header-constants'

import { FULL_API_HEADERS } from '@/lib/security-header-constants'

export function applyApiSecurityHeaders(headers: Headers) {
  const acao = headers.get('Access-Control-Allow-Origin')
  if (acao === '*' || acao === '*, *') {
    headers.delete('Access-Control-Allow-Origin')
  }
  headers.delete('Access-Control-Allow-Credentials')
  for (const { key, value } of FULL_API_HEADERS) {
    headers.set(key, value)
  }
}
