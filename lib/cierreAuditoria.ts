import type { Transaccion } from '@/types/database'

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
      totalCompraMonto += m
      costoCompraCop += m * tas
    } else if (t.tipo === 'VENTA') {
      totalVentaMonto += m
      ingresoVentaCop += m * tas
    }
  }
  const promedioCompraDia = totalCompraMonto > 1e-12 ? costoCompraCop / totalCompraMonto : 0
  const promedioVentaDia = totalVentaMonto > 1e-12 ? ingresoVentaCop / totalVentaMonto : 0
  return {
    totalCompraMonto,
    costoCompraCop,
    promedioCompraDia,
    totalVentaMonto,
    ingresoVentaCop,
    promedioVentaDia,
  }
}

/** (Promedio venta − Promedio compra) × monto vendido del día; requiere compras y ventas ese día. */
export function gananciaDiaPonderadaCop(txs: Transaccion[], moneda: string): number {
  const a = agregarCompraVentaPorMoneda(txs, moneda)
  if (a.totalVentaMonto <= 1e-12 || a.totalCompraMonto <= 1e-12) return 0
  return a.totalVentaMonto * (a.promedioVentaDia - a.promedioCompraDia)
}

export function cierreEstimadoSimple(apertura: number, compras: number, ventas: number): number {
  return apertura + compras - ventas
}
