/** Saldo y costo promedio (COP/unidad) del último cierre registrado por moneda. */
export type SaldoPromedioPrevio = { saldoAnterior: number; promedioAnterior: number }

export type CierreRowParaArrastre = {
  moneda: string
  fecha: string
  cierre_manual: number
  promedio_compra?: number
  promedio_compra_acumulado?: number | null
  /** Para desempatar cuando hay varias filas el mismo día calendario. */
  created_at?: string | null
  id?: string | null
}

/** Normaliza a YYYY-MM-DD para ordenar sin ambigüedad ISO vs date-only. */
export function fechaCierreYYYYMMDD(fecha: string): string {
  const s = String(fecha)
  const m = /^\d{4}-\d{2}-\d{2}/.exec(s)
  return m ? m[0] : s
}

function createdAtMs(created_at?: string | null): number {
  if (!created_at) return 0
  const t = new Date(created_at).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * A partir de filas de `cierres_diarios` con fecha &lt; día operativo,
 * conserva por moneda el cierre más reciente: día calendario máximo, y si empata `created_at` más reciente.
 */
export function saldoPromedioPorMonedaDesdeCierres(rows: CierreRowParaArrastre[]): Map<string, SaldoPromedioPrevio> {
  const best = new Map<
    string,
    { fechaKey: string; createdMs: number; id: string; saldo: number; prom: number }
  >()
  for (const r of rows) {
    const mon = String(r.moneda).toUpperCase()
    const fechaKey = fechaCierreYYYYMMDD(String(r.fecha))
    const createdMs = createdAtMs(r.created_at)
    const id = String(r.id ?? '')
    const acc = Number(r.promedio_compra_acumulado ?? 0)
    const pc = Number(r.promedio_compra ?? 0)
    const prom = acc > 1e-12 ? acc : pc
    const saldo = Number(r.cierre_manual)
    const promFin = Number.isFinite(prom) ? prom : 0

    const cur = best.get(mon)
    const gana =
      !cur ||
      fechaKey > cur.fechaKey ||
      (fechaKey === cur.fechaKey &&
        (createdMs > cur.createdMs || (createdMs === cur.createdMs && id > cur.id)))

    if (gana) {
      best.set(mon, { fechaKey, createdMs, id, saldo, prom: promFin })
    }
  }
  return new Map(
    Array.from(best.entries()).map(([k, v]) => [k, { saldoAnterior: v.saldo, promedioAnterior: v.prom }])
  )
}
