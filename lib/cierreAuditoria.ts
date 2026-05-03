import type { Transaccion } from '@/types/database'

export type DeudaDiaLite = { tipo: string; divisa: string; monto: number }

/** Suma compras / ventas del día por moneda (montos en divisa y COP vía tasa). */
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

export function sumDeudaDiaPorMoneda(rows: DeudaDiaLite[], moneda: string, tipo: 'DEBEN' | 'DEBO'): number {
  let s = 0
  for (const r of rows) {
    if (r.tipo !== tipo || r.divisa !== moneda || r.divisa === 'COP') continue
    s += Number(r.monto) || 0
  }
  return s
}

/**
 * Costo promedio ponderado de la unidad vendida: stock inicial (valor COP) + compras del día,
 * dividido entre unidades iniciales + compradas (estándar contable con apertura histórica).
 */
export function costoPromedioPonderadoVenta(params: {
  montoInicial: number
  promedioInicial: number
  totalCompraMonto: number
  costoCompraCop: number
  promedioCompraDia: number
}): number {
  const { montoInicial, promedioInicial, totalCompraMonto, costoCompraCop, promedioCompraDia } = params
  const denom = montoInicial + totalCompraMonto
  if (denom > 1e-12) {
    return (montoInicial * promedioInicial + costoCompraCop) / denom
  }
  if (totalCompraMonto > 1e-12) return promedioCompraDia
  return promedioInicial
}

/** Ganancia en COP del día por moneda: ingreso ventas − costo WAC × monto vendido. */
export function gananciaNetaCopVenta(params: {
  totalVentaMonto: number
  promedioVentaDia: number
  costoUnitarioWac: number
}): number {
  const { totalVentaMonto, promedioVentaDia, costoUnitarioWac } = params
  if (totalVentaMonto <= 1e-12) return 0
  return totalVentaMonto * (promedioVentaDia - costoUnitarioWac)
}

export function cierreEstimadoOperativo(params: {
  aperturaCaja: number
  compras: number
  ventas: number
  debenDia: number
  deboDia: number
}): number {
  const { aperturaCaja, compras, ventas, debenDia, deboDia } = params
  return aperturaCaja + compras - ventas - debenDia + deboDia
}
