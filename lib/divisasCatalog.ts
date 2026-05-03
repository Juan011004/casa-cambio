export type DivisaOpcion = { codigo: string; nombre_completo: string }

export const DIVISAS_FALLBACK: DivisaOpcion[] = [
  { codigo: 'COP', nombre_completo: 'Peso Colombiano' },
  { codigo: 'USD', nombre_completo: 'Dólar Estadounidense' },
  { codigo: 'EUR', nombre_completo: 'Euro' },
  { codigo: 'MXN', nombre_completo: 'Peso Mexicano' },
  { codigo: 'CAD', nombre_completo: 'Dólar Canadiense' },
  { codigo: 'GBP', nombre_completo: 'Libra Esterlina' },
  { codigo: 'CLP', nombre_completo: 'Peso Chileno' },
  { codigo: 'BRL', nombre_completo: 'Real Brasileño' },
  { codigo: 'PEN', nombre_completo: 'Sol Peruano' },
  { codigo: 'ARS', nombre_completo: 'Peso Argentino' },
  { codigo: 'AUD', nombre_completo: 'Dólar Australiano' },
  { codigo: 'OTRO', nombre_completo: 'Otra divisa' },
]

export const CODIGOS_DIVISA_FILTRO = DIVISAS_FALLBACK.map((d) => d.codigo)
