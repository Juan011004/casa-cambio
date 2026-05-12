import { agregarCompraVentaPorMoneda, promedioCompraConArrastre } from '@/lib/cierreAuditoria'
import type { SaldoPromedioPrevio } from '@/lib/ultimoCierre'
import type { Transaccion } from '@/types/database'

/** Valores guardados en `auditoria_overrides` (null = sin override en BD). */
export type AuditoriaOverrideVals = {
  cantidad_inicial?: number | null
  promedio_anterior?: number | null
  promedio_compra_hoy?: number | null
  /** Si está definido, sustituye la ganancia COP calculada por moneda (prioridad manual). */
  ganancia_cop?: number | null
}

export type FilaAuditoriaViva = {
  moneda: string
  cantidadInicial: number
  promedioAnterior: number
  cantidadFinal: number
  promedioCompraHoy: number
  promedioVentaHoy: number
  /** prom. venta hoy − prom. compra hoy (COP por unidad de divisa) */
  deltaVentaMenosCompraHoy: number
  gananciaCop: number
}

/** Monedas a mostrar: aparecen en transacciones del día, inventario o último cierre previo. */
export function monedasParaAuditoria(
  txs: Transaccion[],
  inv: { divisa: string }[],
  prevPorMoneda: Map<string, SaldoPromedioPrevio>
): string[] {
  const s = new Set<string>()
  for (const t of txs) s.add(String(t.moneda).toUpperCase())
  for (const i of inv) s.add(String(i.divisa).toUpperCase())
  for (const k of Array.from(prevPorMoneda.keys())) s.add(k)
  return Array.from(s).sort((a, b) => a.localeCompare(b))
}

/**
 * Auditoría en vivo para la fecha del día (transacciones ya filtradas al rango del día).
 * Combina último cierre previo + movimiento del día.
 */
export function filasAuditoriaVivo(
  txsDelDia: Transaccion[],
  prevPorMoneda: Map<string, SaldoPromedioPrevio>,
  monedas: string[],
  overrides?: Map<string, AuditoriaOverrideVals>
): FilaAuditoriaViva[] {
  const out: FilaAuditoriaViva[] = []
  for (const moneda of monedas) {
    const prev = prevPorMoneda.get(moneda) ?? { saldoAnterior: 0, promedioAnterior: 0 }
    const ov = overrides?.get(moneda) ?? null
    const a = agregarCompraVentaPorMoneda(txsDelDia, moneda)
    const cantidadInicial = ov?.cantidad_inicial != null ? Number(ov.cantidad_inicial) : prev.saldoAnterior
    const promedioAnterior = ov?.promedio_anterior != null ? Number(ov.promedio_anterior) : prev.promedioAnterior
    const cantidadFinal = cantidadInicial + a.totalCompraMonto - a.totalVentaMonto
    const promedioCompraHoyAuto = promedioCompraConArrastre(txsDelDia, moneda, cantidadInicial, promedioAnterior)
    const promedioCompraHoy = ov?.promedio_compra_hoy != null ? Number(ov.promedio_compra_hoy) : promedioCompraHoyAuto
    const promedioVentaHoy = a.promedioVentaDia
    const gananciaCop =
      ov?.ganancia_cop != null && Number.isFinite(Number(ov.ganancia_cop))
        ? Number(ov.ganancia_cop)
        : a.totalVentaMonto > 1e-12
          ? a.totalVentaMonto * (promedioVentaHoy - promedioCompraHoy)
          : 0
    out.push({
      moneda,
      cantidadInicial,
      promedioAnterior,
      cantidadFinal,
      promedioCompraHoy,
      promedioVentaHoy,
      deltaVentaMenosCompraHoy: promedioVentaHoy - promedioCompraHoy,
      gananciaCop,
    })
  }
  return out
}

/**
 * Lista de ganancias por moneda alineada con la tabla de auditoría (respeta overrides y monedas sin tx pero con inventario/cierre).
 */
export function gananciaListaDesdeAuditoria(
  txsDelDia: Transaccion[],
  inv: { divisa: string }[],
  prevPorMoneda: Map<string, SaldoPromedioPrevio>,
  overrides?: Map<string, AuditoriaOverrideVals>
): { codigo: string; valor: number }[] {
  const monedas = monedasParaAuditoria(txsDelDia, inv, prevPorMoneda)
  const filas = filasAuditoriaVivo(txsDelDia, prevPorMoneda, monedas, overrides)
  const out: { codigo: string; valor: number }[] = []
  for (const row of filas) {
    if (Math.abs(row.gananciaCop) > 1e-6) out.push({ codigo: row.moneda, valor: row.gananciaCop })
  }
  return out
}
