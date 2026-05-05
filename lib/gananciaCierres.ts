/** `cierres_diarios` tiene una fila por moneda y día: hay que agrupar por fecha antes de sumar. */

export function sumGananciaPorDia(
  rows: { fecha: string | unknown; ganancia_calculada: unknown }[]
): Map<string, number> {
  const byDate = new Map<string, number>()
  for (const r of rows) {
    const key = String(r.fecha).slice(0, 10)
    const g = Number(r.ganancia_calculada ?? 0)
    if (!Number.isFinite(g)) continue
    byDate.set(key, (byDate.get(key) ?? 0) + g)
  }
  return byDate
}

/** Suma histórica total de ganancias por día (todas las fechas). */
export function sumGananciaHistoricaTotal(
  rows: { fecha: string | unknown; ganancia_calculada: unknown }[]
): number {
  const byDate = sumGananciaPorDia(rows)
  let s = 0
  for (const v of Array.from(byDate.values())) s += v
  return s
}

/**
 * Suma ganancias de todos los cierres con fecha de cierre ≤ `fechaFinYYYYYMMDD` (inclusive).
 */
export function sumGananciaHistoricaHastaFecha(
  rows: { fecha: string | unknown; ganancia_calculada: unknown }[],
  fechaFinYYYYMMDD: string
): number {
  const byDate = sumGananciaPorDia(rows)
  let s = 0
  for (const [d, v] of Array.from(byDate.entries())) {
    if (d <= fechaFinYYYYMMDD) s += v
  }
  return s
}
