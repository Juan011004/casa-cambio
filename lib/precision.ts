export function truncN(value: number, decimals: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const d = Math.max(0, Math.min(12, Math.trunc(decimals)))
  const f = 10 ** d
  // Truncar hacia cero (sin redondear hacia arriba).
  return Math.trunc(n * f) / f
}

/** Cuantiza (trunca) a 6 decimales para cálculo interno. */
export function q6(value: number): number {
  return truncN(value, 6)
}

/** Truncado final a 2 decimales para visualización. */
export function trunc2(value: number): number {
  return truncN(value, 2)
}

