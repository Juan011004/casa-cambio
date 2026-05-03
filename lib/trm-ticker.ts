/** Orden del ticker TRM en dashboard (sin OTRO). */
export const TRM_TICKER_ORDER = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'BRL',
  'MXN',
  'CLP',
  'PEN',
  'ARS',
  'AUD',
] as const

export type TrmMercadoFila = {
  codigo: string
  nombre: string
  valor_cop: number
  ultima_actualizacion: string
}
