import type { CopPorUnidad } from '@/lib/trm'

/** Convierte un monto en divisa a COP usando TRM del día de mercado (COP = monto si divisa es COP). */
export function montoDivisaEnCop(monto: number, divisa: string, copMap: CopPorUnidad): number {
  const d = divisa.toUpperCase()
  if (d === 'COP') return monto
  const t = Number((copMap as Record<string, number>)[d] ?? 0)
  return Number.isFinite(t) && t > 0 ? monto * t : 0
}

export function valorInventarioCop(
  rows: { divisa: string; cantidad_actual: number }[],
  copMap: CopPorUnidad
): number {
  let s = 0
  for (const r of rows) {
    s += montoDivisaEnCop(Number(r.cantidad_actual), r.divisa, copMap)
  }
  return s
}

/** Posición neta de deudas en COP: lo que le deben menos lo que debes. */
export function saldoDeudasNetoCop(
  deben: { divisa: string; monto: number }[],
  debo: { divisa: string; monto: number }[],
  copMap: CopPorUnidad
): number {
  let s = 0
  for (const r of deben) s += montoDivisaEnCop(r.monto, r.divisa, copMap)
  for (const r of debo) s -= montoDivisaEnCop(r.monto, r.divisa, copMap)
  return s
}

export function valorCierresManualCop(
  cierres: { moneda: string; cierre_manual: number }[],
  copMap: CopPorUnidad
): number {
  let s = 0
  for (const r of cierres) {
    s += montoDivisaEnCop(Number(r.cierre_manual), r.moneda, copMap)
  }
  return s
}

/** Suma en COP de montos en divisa (TRM actual), incluyendo COP con tasa 1. */
export function totalDeudasMontoCop(
  rows: { divisa: string; monto: number }[],
  copMap: CopPorUnidad
): number {
  let s = 0
  for (const r of rows) {
    s += montoDivisaEnCop(Number(r.monto), r.divisa, copMap)
  }
  return s
}
