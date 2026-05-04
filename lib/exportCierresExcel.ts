import * as XLSX from 'xlsx'
import type { FilaAuditoriaViva } from '@/lib/auditoriaVivo'
import type { CierreDiarioAuditoria } from '@/types/database'

export function exportAuditoriaVivoExcel(
  rows: FilaAuditoriaViva[],
  fechaEtiqueta: string,
  etiquetaMoneda: (codigo: string) => string
) {
  const data = rows.map((r) => ({
    Fecha: fechaEtiqueta,
    Moneda: etiquetaMoneda(r.moneda),
    'Cant. inicial': r.cantidadInicial,
    'Prom. compra anterior': r.promedioAnterior,
    'Cant. final': r.cantidadFinal,
    'Prom. compra hoy': r.promedioCompraHoy,
    'Prom. venta hoy': r.promedioVentaHoy,
    'Ganancia (COP)': r.gananciaCop,
  }))
  const ws = XLSX.utils.json_to_sheet(
    data.length ? data : [{ Fecha: fechaEtiqueta, Moneda: '—', 'Cant. inicial': 0 }]
  )
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Auditoría día')
  XLSX.writeFile(wb, `auditoria_dia_${fechaEtiqueta}.xlsx`)
}

export function exportCierresDiariosExcel(rows: CierreDiarioAuditoria[], fechaEtiqueta: string) {
  const data = rows.map((r) => ({
    Fecha: r.fecha,
    Moneda: r.moneda,
    Origen: r.origen ?? 'OPERATIVO',
    'Cant. inicial': r.apertura,
    'Prom. anterior': r.promedio_anterior ?? 0,
    'Total comprado COP día': r.total_comprado_dia ?? 0,
    'Total comprado (divisa)': r.total_comprado_divisa ?? 0,
    'Nuevo prom. compra': r.promedio_compra_acumulado ?? r.promedio_compra ?? 0,
    'Total vendido COP día': r.total_vendido_dia ?? 0,
    'Total vendido (divisa)': r.total_vendido_divisa ?? 0,
    'Promedio venta día': r.promedio_venta_dia ?? r.promedio_venta ?? 0,
    Ganancia: r.ganancia_calculada,
    Estimado: r.cierre_estimado,
    Manual: r.cierre_manual,
    Diferencia: Number(r.cierre_manual) - Number(r.cierre_estimado),
  }))
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Fecha: fechaEtiqueta, Moneda: '—' }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cierres')
  XLSX.writeFile(wb, `cierres_${fechaEtiqueta}.xlsx`)
}
