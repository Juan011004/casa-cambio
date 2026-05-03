import * as XLSX from 'xlsx'
import type { CierreDiarioAuditoria } from '@/types/database'

export function exportCierresDiariosExcel(rows: CierreDiarioAuditoria[], fechaEtiqueta: string) {
  const data = rows.map((r) => ({
    Fecha: r.fecha,
    Moneda: r.moneda,
    Inicial: r.monto_inicial,
    'Promedio compra (COP/u)': r.promedio_compra_dia,
    'Promedio venta (COP/u)': r.promedio_venta_dia,
    'Cierre estimado': r.cierre_estimado_sistema,
    'Cierre real': r.cierre_manual_fisico,
    'Dif. arqueo': r.diferencia_arqueo,
    'Ganancia COP': r.ganancia_neta_cop,
  }))
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Fecha: fechaEtiqueta, Moneda: '—' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cierres')
  XLSX.writeFile(wb, `cierres_diarios_${fechaEtiqueta}.xlsx`)
}
