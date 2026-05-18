import { formatCOP, formatMilesEs } from '@/lib/formatMoney'
import type { AuditoriaOverrideVals, FilaAuditoriaViva } from '@/lib/auditoriaVivo'

export type AuditFieldTextRow = { pa: string; pch: string; g: string }

export function fmtProm(n: number) {
  return formatMilesEs(n, 2)
}

export function buildAuditFieldText(
  filas: FilaAuditoriaViva[],
  auditOverrides: Map<string, AuditoriaOverrideVals>
): Record<string, AuditFieldTextRow> {
  const out: Record<string, AuditFieldTextRow> = {}
  for (const row of filas) {
    const mon = row.moneda
    const ov = auditOverrides.get(mon) ?? {}
    const fmt = (n: number, max: number) => (Number.isFinite(n) ? formatMilesEs(n, max) : '')
    out[mon] = {
      pa: ov.promedio_anterior != null ? fmt(ov.promedio_anterior, 2) : fmt(row.promedioAnterior, 2),
      pch: ov.promedio_compra_hoy != null ? fmt(ov.promedio_compra_hoy, 2) : fmt(row.promedioCompraHoy, 2),
      g: ov.ganancia_cop != null ? fmt(ov.ganancia_cop, 2) : '',
    }
  }
  return out
}

export function formatGananciaCopCell(gananciaCop: number) {
  return Math.abs(gananciaCop) < 1e-6 ? formatMilesEs(0, 0) : formatCOP(gananciaCop)
}
