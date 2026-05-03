import * as XLSX from 'xlsx'
import type { CierreDiarioAuditoria } from '@/types/database'

export function exportCierresDiariosExcel(rows: CierreDiarioAuditoria[], fechaEtiqueta: string) {
  const data = rows.map((r) => ({
    Fecha: r.fecha,
    Moneda: r.moneda,
    Apertura: r.apertura,
    'Cierre estimado': r.cierre_estimado,
    'Cierre manual': r.cierre_manual,
    'Ganancia': r.ganancia_calculada,
  }))
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Fecha: fechaEtiqueta, Moneda: '—' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cierres')
  XLSX.writeFile(wb, `cierres_${fechaEtiqueta}.xlsx`)
}
