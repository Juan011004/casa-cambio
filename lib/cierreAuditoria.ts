import type { Transaccion } from '@/types/database'
import { q6 } from '@/lib/precision'

/** Suma compras / ventas del día por moneda y promedios ponderados (COP por unidad de divisa). */
export function agregarCompraVentaPorMoneda(txs: Transaccion[], moneda: string) {
  let totalCompraMonto = 0
  let costoCompraCop = 0
  let totalVentaMonto = 0
  let ingresoVentaCop = 0
  for (const t of txs) {
    if (t.moneda !== moneda) continue
    const m = Number(t.monto_divisa)
    const tas = Number(t.tasa_aplicada)
    if (!Number.isFinite(m) || !Number.isFinite(tas)) continue
    if (t.tipo === 'COMPRA') {
      totalCompraMonto = q6(totalCompraMonto + m)
      costoCompraCop = q6(costoCompraCop + q6(m * tas))
    } else if (t.tipo === 'VENTA') {
      totalVentaMonto = q6(totalVentaMonto + m)
      ingresoVentaCop = q6(ingresoVentaCop + q6(m * tas))
    }
  }
  const promedioCompraDia = totalCompraMonto > 1e-12 ? q6(costoCompraCop / totalCompraMonto) : 0
  const promedioVentaDia = totalVentaMonto > 1e-12 ? q6(ingresoVentaCop / totalVentaMonto) : 0
  return {
    totalCompraMonto,
    costoCompraCop,
    promedioCompraDia,
    totalVentaMonto,
    ingresoVentaCop,
    promedioVentaDia,
  }
}

/**
 * Costo promedio ponderado del inventario (COP/unidad) con arrastre del cierre anterior.
 * (SaldoAnterior × PromedioAnterior + Σ compra hoy × tasa) / (SaldoAnterior + Σ compra hoy).
 */
export function promedioCompraConArrastre(
  txs: Transaccion[],
  moneda: string,
  saldoAnterior: number,
  promedioAnterior: number
): number {
  const a = agregarCompraVentaPorMoneda(txs, moneda)
  const denom = saldoAnterior + a.totalCompraMonto
  if (denom <= 1e-12) {
    if (a.totalCompraMonto > 1e-12) return a.promedioCompraDia
    return promedioAnterior
  }
  return q6((q6(saldoAnterior * promedioAnterior) + a.costoCompraCop) / denom)
}

/** (Promedio venta del día − promedio compra calculado) × total vendido hoy. */
export function gananciaDiaConPromedioCompra(
  txs: Transaccion[],
  moneda: string,
  promedioCompraCalculado: number
): number {
  const a = agregarCompraVentaPorMoneda(txs, moneda)
  if (a.totalVentaMonto <= 1e-12) return 0
  return q6(a.totalVentaMonto * q6(a.promedioVentaDia - promedioCompraCalculado))
}

/**
 * Ganancia del día en COP usando arrastre de costo (misma moneda).
 * `saldoAnterior` / `promedioAnterior` vienen del último `cierres_diarios` anterior al día.
 */
export function gananciaDiaPonderadaCop(
  txs: Transaccion[],
  moneda: string,
  saldoAnterior = 0,
  promedioAnterior = 0
): number {
  const wac = promedioCompraConArrastre(txs, moneda, saldoAnterior, promedioAnterior)
  return gananciaDiaConPromedioCompra(txs, moneda, wac)
}

export function cierreEstimadoSimple(apertura: number, compras: number, ventas: number): number {
  return apertura + compras - ventas
}
