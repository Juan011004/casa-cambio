export type UserRole = 'cajero' | 'supervisor' | 'admin'

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: UserRole
  activo: boolean
  created_at: string
}

export type MetodoPago = 'Efectivo' | 'Nequi' | 'Cheque'

export interface Transaccion {
  id: string
  usuario_id: string | null
  tipo: 'COMPRA' | 'VENTA'
  moneda: string
  monto_divisa: number
  tasa_aplicada: number
  total_cop: number
  fecha: string
  metodo_pago?: MetodoPago | null
}

export interface InventarioItem {
  id?: string
  usuario_id?: string
  divisa: string
  cantidad_actual: number
  ultima_actualizacion?: string
}

export interface TrmRegistro {
  valor: number
  created_at: string
}

export interface Gasto {
  id: string
  concepto: string
  monto_cop: number
  fecha: string
}

export interface CajaBovedaRow {
  divisa: string
  denominacion: number
  unidades: number
  subtotalCara: number
}

export type EstadoDeuda = 'PENDIENTE' | 'SALDADO'

export interface RegistroDeuda {
  id: string
  responsable: string
  divisa: string
  monto: number
  fecha: string
  estado: EstadoDeuda
}

export type ActionResult<T = void> =
  | ([T] extends [void] ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string; code?: string }

export type OrigenCierre = 'OPERATIVO' | 'CARGA_INICIAL'

/** Fila de cierre diario (`cierres_diarios`). */
export interface CierreDiarioAuditoria {
  id: string
  usuario_id: string
  fecha: string
  moneda: string
  apertura: number
  cierre_manual: number
  cierre_estimado: number
  ganancia_calculada: number
  promedio_compra: number
  /** WAC guardado al cierre; puede faltar en datos previos al ALTER. */
  promedio_compra_acumulado?: number
  /** COP/unidad arrastrado desde el último cierre antes de este día. */
  promedio_anterior?: number
  total_comprado_divisa?: number
  total_vendido_divisa?: number
  /** Σ COP en compras del día (misma moneda de la fila). */
  total_comprado_dia?: number
  /** Σ COP en ventas del día. */
  total_vendido_dia?: number
  promedio_venta: number
  promedio_venta_dia?: number
  origen?: OrigenCierre
  created_at: string
}
