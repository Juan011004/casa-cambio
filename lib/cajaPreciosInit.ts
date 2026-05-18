import { addDaysYYYYMMDD } from '@/lib/utils'
import { filasAuditoriaVivo, monedasParaAuditoria } from '@/lib/auditoriaVivo'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'
import type { Transaccion } from '@/types/database'

const PROMEDIO_HOY_AUTO = new Set(['USD', 'EUR'])

export type CajaPrecioRow = { moneda: string; precio_compra: number; fecha: string }

/**
 * Precio de compra por moneda para la fecha operativa:
 * 1) Manual guardado ese día (`caja_precios.fecha === fecha`) — prioridad absoluta.
 * 2) USD/EUR: promedio de compra calculado del día.
 * 3) Resto: precio guardado el día anterior.
 */
export function buildPreciosCompraIniciales(params: {
  fecha: string
  divisasCodigos: string[]
  preciosRows: CajaPrecioRow[]
  txs: Transaccion[]
  cierresPrev: CierreRowParaArrastre[]
}): Record<string, number> {
  const { fecha, divisasCodigos, preciosRows, txs, cierresPrev } = params
  const ayer = addDaysYYYYMMDD(fecha, -1)

  const manualHoy = new Map<string, number>()
  const precioAyer = new Map<string, number>()
  for (const r of preciosRows) {
    const mon = String(r.moneda).toUpperCase()
    const f = String(r.fecha).slice(0, 10)
    const v = Number(r.precio_compra)
    if (!Number.isFinite(v) || v <= 0) continue
    if (f === fecha) manualHoy.set(mon, v)
    if (f === ayer) precioAyer.set(mon, v)
  }

  const prevMap = saldoPromedioPorMonedaDesdeCierres(cierresPrev)
  const monedasAudit = monedasParaAuditoria(txs, [], prevMap)
  const promCompraHoy = new Map<string, number>()
  for (const row of filasAuditoriaVivo(txs, prevMap, monedasAudit)) {
    if (row.promedioCompraHoy > 0) promCompraHoy.set(row.moneda, row.promedioCompraHoy)
  }

  const out: Record<string, number> = {}
  for (const codigo of divisasCodigos) {
    const mon = codigo.toUpperCase()
    if (manualHoy.has(mon)) {
      out[mon] = manualHoy.get(mon)!
      continue
    }
    if (PROMEDIO_HOY_AUTO.has(mon)) {
      const p = promCompraHoy.get(mon) ?? 0
      if (p > 0) out[mon] = p
      continue
    }
    const pAyer = precioAyer.get(mon)
    if (pAyer != null && pAyer > 0) out[mon] = pAyer
  }
  return out
}
