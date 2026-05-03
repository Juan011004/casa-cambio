/**
 * Ventana fija: máximo `limit` peticiones por `windowMs` por clave (IP o IP+acción).
 * En serverless varias instancias = límites no globales; para producción alta carga usar Redis/Upstash.
 */

const DEFAULT_LIMIT = 10
const DEFAULT_WINDOW_MS = 10_000

type Bucket = { t: number[] }

const buckets = new Map<string, number[]>()

function prune(ts: number[], windowStart: number): number[] {
  return ts.filter((x) => x > windowStart)
}

export function checkRateLimit(
  key: string,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW_MS
): boolean {
  const now = Date.now()
  const windowStart = now - windowMs
  const raw = buckets.get(key) ?? []
  const pruned = prune(raw, windowStart)
  if (pruned.length >= limit) {
    buckets.set(key, pruned)
    return false
  }
  pruned.push(now)
  buckets.set(key, pruned)
  return true
}
