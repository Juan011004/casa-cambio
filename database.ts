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
          promedio_venta: number
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
          promedio_venta?: number
          created_at?: string
        }
        Update: {
          apertura?: number
          cierre_manual?: number
          cierre_estimado?: number
          ganancia_calculada?: number
          promedio_compra?: number
          promedio_venta?: number
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
