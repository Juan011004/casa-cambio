/** Log estructurado en servidor sin volcar PII completa. */
export function logServerError(scope: string, err: unknown, extra?: Record<string, string>) {
  const msg = err instanceof Error ? err.message : String(err)
  const safe = msg.slice(0, 500)
  console.error(`[${scope}]`, safe, extra ?? {})
}
