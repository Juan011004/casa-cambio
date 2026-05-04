import { agregarCompraVentaPorMoneda, promedioCompraConArrastre } from '@/lib/cierreAuditoria'
import type { SaldoPromedioPrevio } from '@/lib/ultimoCierre'
import type { Transaccion } from '@/types/database'

export type FilaAuditoriaViva = {
  moneda: string
  cantidadInicial: number
  promedioAnterior: number
  cantidadFinal: number
  promedioCompraHoy: number
  promedioVentaHoy: number
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
  monedas: string[]
): FilaAuditoriaViva[] {
  const out: FilaAuditoriaViva[] = []
  for (const moneda of monedas) {
    const prev = prevPorMoneda.get(moneda) ?? { saldoAnterior: 0, promedioAnterior: 0 }
    const a = agregarCompraVentaPorMoneda(txsDelDia, moneda)
    const cantidadFinal = prev.saldoAnterior + a.totalCompraMonto - a.totalVentaMonto
    const promedioCompraHoy = promedioCompraConArrastre(
      txsDelDia,
      moneda,
      prev.saldoAnterior,
      prev.promedioAnterior
    )
    const promedioVentaHoy = a.promedioVentaDia
    const gananciaCop =
      a.totalVentaMonto > 1e-12 ? a.totalVentaMonto * (promedioVentaHoy - promedioCompraHoy) : 0
    out.push({
      moneda,
      cantidadInicial: prev.saldoAnterior,
      promedioAnterior: prev.promedioAnterior,
      cantidadFinal,
      promedioCompraHoy,
      promedioVentaHoy,
      gananciaCop,
    })
  }
  return out
}
