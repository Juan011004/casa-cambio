/** Saldo y costo promedio (COP/unidad) del último cierre registrado por moneda. */
export type SaldoPromedioPrevio = { saldoAnterior: number; promedioAnterior: number }

export type CierreRowParaArrastre = {
  moneda: string
  fecha: string
  cierre_manual: number
  promedio_compra?: number
  promedio_compra_acumulado?: number | null
}

/**
 * A partir de filas de `cierres_diarios` con fecha &lt; día operativo,
 * conserva por moneda el registro con `fecha` más reciente.
 */
export function saldoPromedioPorMonedaDesdeCierres(rows: CierreRowParaArrastre[]): Map<string, SaldoPromedioPrevio> {
  const best = new Map<string, { fecha: string; saldo: number; prom: number }>()
  for (const r of rows) {
    const mon = String(r.moneda).toUpperCase()
    const fecha = String(r.fecha)
    const cur = best.get(mon)
    if (!cur || fecha > cur.fecha) {
      const acc = Number(r.promedio_compra_acumulado ?? 0)
      const pc = Number(r.promedio_compra ?? 0)
      const prom = acc > 1e-12 ? acc : pc
      best.set(mon, {
        fecha,
        saldo: Number(r.cierre_manual),
        prom: Number.isFinite(prom) ? prom : 0,
      })
    }
  }
  return new Map(
    Array.from(best.entries()).map(([k, v]) => [k, { saldoAnterior: v.saldo, promedioAnterior: v.prom }])
  )
}
