export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      registro_trm: {
        Row: {
          id: number
          valor: number
          created_at: string
        }
        Insert: {
          valor: number
          created_at?: string
        }
        Update: {
          valor?: number
        }
        Relationships: []
      }
      trm_mercado: {
        Row: {
          codigo: string
          nombre: string | null
          valor_cop: number
          ultima_actualizacion: string
        }
        Insert: {
          codigo: string
          nombre?: string | null
          valor_cop: number
          ultima_actualizacion?: string
        }
        Update: {
          nombre?: string | null
          valor_cop?: number
          ultima_actualizacion?: string
        }
        Relationships: []
      }
      divisas: {
        Row: {
          id: string
          codigo: string
          nombre: string
          nombre_completo: string | null
          activo: boolean | null
        }
        Insert: {
          id?: string
          codigo: string
          nombre: string
          nombre_completo?: string | null
          activo?: boolean | null
        }
        Update: {
          nombre?: string
          nombre_completo?: string | null
          activo?: boolean | null
        }
        Relationships: []
      }
      gastos: {
        Row: {
          id: string
          usuario_id: string
          concepto: string
          monto_cop: number
          fecha: string
        }
        Insert: {
          id?: string
          usuario_id: string
          concepto: string
          monto_cop: number
          fecha?: string
        }
        Update: {
          concepto?: string
          monto_cop?: number
        }
        Relationships: []
      }
      transacciones: {
        Row: {
          id: string
          usuario_id: string | null
          tipo: 'COMPRA' | 'VENTA'
          moneda: string
          monto_divisa: number
          tasa_aplicada: number
          total_cop: number
          fecha: string
          metodo_pago: 'Efectivo' | 'Nequi' | 'Cheque' | null
        }
        Insert: {
          usuario_id?: string | null
          tipo: 'COMPRA' | 'VENTA'
          moneda: string
          monto_divisa: number
          tasa_aplicada: number
          total_cop: number
          fecha?: string
          metodo_pago?: 'Efectivo' | 'Nequi' | 'Cheque' | null
        }
        Update: {
          usuario_id?: string | null
          tipo?: 'COMPRA' | 'VENTA'
          moneda?: string
          monto_divisa?: number
          tasa_aplicada?: number
          total_cop?: number
          fecha?: string
          metodo_pago?: 'Efectivo' | 'Nequi' | 'Cheque' | null
        }
        Relationships: []
      }
      caja_diaria: {
        Row: {
          id: string
          usuario_id: string | null
          fecha: string
          tipo: 'APERTURA' | 'CIERRE'
          moneda: string
          monto: number
          created_at: string | null
        }
        Insert: {
          id?: string
          usuario_id?: string | null
          fecha?: string
          tipo: 'APERTURA' | 'CIERRE'
          moneda: string
          monto: number
          created_at?: string | null
        }
        Update: {
          monto?: number
        }
        Relationships: []
      }
      cierres_diarios: {
        Row: {
          id: string
          usuario_id: string
          fecha: string
          moneda: string
          apertura: number
          cierre_manual: number
          cierre_estimado: number
          ganancia_calculada: number
          promedio_compra: number
          promedio_compra_acumulado: number
          promedio_anterior: number
          total_comprado_divisa: number
          total_vendido_divisa: number
          total_comprado_dia: number
          total_vendido_dia: number
          promedio_venta_dia: number
          promedio_venta: number
          origen: 'OPERATIVO' | 'CARGA_INICIAL'
          created_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          fecha: string
          moneda: string
          apertura?: number
          cierre_manual?: number
          cierre_estimado?: number
          ganancia_calculada?: number
          promedio_compra?: number
          promedio_compra_acumulado?: number
          promedio_anterior?: number
          total_comprado_divisa?: number
          total_vendido_divisa?: number
          total_comprado_dia?: number
          total_vendido_dia?: number
          promedio_venta_dia?: number
          promedio_venta?: number
          origen?: 'OPERATIVO' | 'CARGA_INICIAL'
          created_at?: string
        }
        Update: {
          apertura?: number
          cierre_manual?: number
          cierre_estimado?: number
          ganancia_calculada?: number
          promedio_compra?: number
          promedio_compra_acumulado?: number
          promedio_anterior?: number
          total_comprado_divisa?: number
          total_vendido_divisa?: number
          total_comprado_dia?: number
          total_vendido_dia?: number
          promedio_venta_dia?: number
          promedio_venta?: number
          origen?: 'OPERATIVO' | 'CARGA_INICIAL'
        }
        Relationships: []
      }
      inventario: {
        Row: {
          id: string
          usuario_id: string
          divisa: string
          cantidad_actual: number
          ultima_actualizacion: string
        }
        Insert: {
          id?: string
          usuario_id: string
          divisa: string
          cantidad_actual?: number
          ultima_actualizacion?: string
        }
        Update: {
          cantidad_actual?: number
          ultima_actualizacion?: string
        }
        Relationships: []
      }
      balances_diarios: {
        Row: {
          id: string
          usuario_id: string
          fecha: string
          tengo_total: number
          debo_tener_total: number
          caja_total_cop?: number
          ganancias_dia: number
          gastos_dia: number
          me_deben_total: number
          debo_total: number
          detalle_arqueo: Json | null
          detalle_deudas: Json | null
          detalle_tarjetas: Json | null
          created_at: string
          ultima_modificacion?: string
        }
        Insert: {
          id?: string
          usuario_id: string
          fecha: string
          tengo_total?: number
          debo_tener_total?: number
          caja_total_cop?: number
          ganancias_dia?: number
          gastos_dia?: number
          me_deben_total?: number
          debo_total?: number
          detalle_arqueo?: Json | null
          detalle_deudas?: Json | null
          detalle_tarjetas?: Json | null
          created_at?: string
          ultima_modificacion?: string
        }
        Update: {
          tengo_total?: number
          debo_tener_total?: number
          caja_total_cop?: number
          ganancias_dia?: number
          gastos_dia?: number
          me_deben_total?: number
          debo_total?: number
          detalle_arqueo?: Json | null
          detalle_deudas?: Json | null
          detalle_tarjetas?: Json | null
          ultima_modificacion?: string
        }
        Relationships: []
      }
      caja_precios: {
        Row: {
          id: string
          usuario_id: string
          fecha: string
          moneda: string
          precio_compra: number
          created_at: string
          ultima_modificacion: string
        }
        Insert: {
          id?: string
          usuario_id: string
          fecha: string
          moneda: string
          precio_compra?: number
          created_at?: string
          ultima_modificacion?: string
        }
        Update: {
          precio_compra?: number
          ultima_modificacion?: string
        }
        Relationships: []
      }
      auditoria_overrides: {
        Row: {
          id: string
          usuario_id: string
          fecha: string
          moneda: string
          cantidad_inicial: number | null
          promedio_anterior: number | null
          promedio_compra_hoy: number | null
          updated_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          fecha: string
          moneda: string
          cantidad_inicial?: number | null
          promedio_anterior?: number | null
          promedio_compra_hoy?: number | null
          updated_at?: string
        }
        Update: {
          cantidad_inicial?: number | null
          promedio_anterior?: number | null
          promedio_compra_hoy?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pagos_deudas: {
        Row: {
          id: string
          usuario_id: string
          deuda_id: string
          monto_pagado: number
          fecha_pago: string
        }
        Insert: {
          id?: string
          usuario_id: string
          deuda_id: string
          monto_pagado: number
          fecha_pago?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      deudas: {
        Row: {
          id: string
          usuario_id: string
          tipo: 'DEBEN' | 'DEBO'
          responsable: string
          divisa: string
          monto: number
          fecha: string
          estado: 'PENDIENTE' | 'SALDADO' | null
        }
        Insert: {
          usuario_id: string
          tipo: 'DEBEN' | 'DEBO'
          responsable: string
          divisa: string
          monto: number
          fecha?: string
          estado?: 'PENDIENTE' | 'SALDADO' | null
        }
        Update: {
          monto?: number
          estado?: 'PENDIENTE' | 'SALDADO' | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          id: string
          email: string
          nombre: string
          rol: 'admin' | 'cajero' | 'supervisor'
          activo: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          nombre: string
          rol?: 'admin' | 'cajero' | 'supervisor'
          activo?: boolean
        }
        Update: {
          nombre?: string
          rol?: 'admin' | 'cajero' | 'supervisor'
          activo?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}

export type RegistroTrm = Database['public']['Tables']['registro_trm']['Row']
export type TrmMercadoRow = Database['public']['Tables']['trm_mercado']['Row']
export type DivisaRow = Database['public']['Tables']['divisas']['Row']
export type Transaccion = Database['public']['Tables']['transacciones']['Row']
export type TransaccionInsert = Database['public']['Tables']['transacciones']['Insert']
export type InventarioItem = Database['public']['Tables']['inventario']['Row']
export type Usuario = Database['public']['Tables']['usuarios']['Row']
export type GastoRow = Database['public']['Tables']['gastos']['Row']
export type DeudaRow = Database['public']['Tables']['deudas']['Row']
export type CajaDiariaRow = Database['public']['Tables']['caja_diaria']['Row']
export type CierreDiarioRow = Database['public']['Tables']['cierres_diarios']['Row']
