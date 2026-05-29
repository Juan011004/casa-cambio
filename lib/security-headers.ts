export {
  API_SECURITY_HEADERS,
  NO_STORE_HEADERS,
  SECURITY_HEADERS,
} from '@/lib/security-header-constants'

import { API_SECURITY_HEADERS } from '@/lib/security-header-constants'

export function applyApiSecurityHeaders(headers: Headers) {
  const acao = headers.get('Access-Control-Allow-Origin')
  if (acao === '*' || acao === '*, *') {
    headers.delete('Access-Control-Allow-Origin')
  }
  headers.delete('Access-Control-Allow-Credentials')
  for (const { key, value } of API_SECURITY_HEADERS) {
    headers.set(key, value)
  }
}
