/** Obtiene COP por unidad desde exchangerate-api.com (USD base). */

export type TrmMercadoUpsert = {
  codigo: string
  nombre: string
  valor_cop: number
}

const NOMBRES: Record<string, string> = {
  USD: 'Dólar',
  EUR: 'Euro',
  GBP: 'Libra',
  BRL: 'Real',
  MXN: 'Peso MX',
  CAD: 'Dólar CAN',
  CLP: 'Peso CHI',
  PEN: 'Sol',
  ARS: 'Peso ARG',
  AUD: 'Dólar AUS',
  OTRO: 'Otra divisa',
}

export async function fetchTrmRowsFromExchangeApi(): Promise<TrmMercadoUpsert[]> {
  const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
    cache: 'no-store',
  })
  if (!r.ok) throw new Error(`TRM HTTP ${r.status}`)
  const j = (await r.json()) as { rates?: Record<string, number> }
  const rates = j.rates
  if (!rates?.COP || !Number.isFinite(rates.COP) || rates.COP <= 0) {
    throw new Error('Respuesta TRM sin COP')
  }

  const copUsd = rates.COP
  const mk = (codigo: string, valor: number): TrmMercadoUpsert => ({
    codigo,
    nombre: NOMBRES[codigo] ?? codigo,
    // Alta precisión: no redondear a 2 decimales para no perder milésimas.
    valor_cop: Number.isFinite(valor) ? Math.trunc(valor * 1_000_000) / 1_000_000 : 0,
  })

  const map = new Map<string, TrmMercadoUpsert>()
  map.set('USD', mk('USD', copUsd))

  const cross = (code: keyof typeof rates) => {
    const x = rates[code]
    if (x && Number.isFinite(x) && x > 0) map.set(code, mk(code, copUsd / x))
  }
  cross('EUR')
  cross('GBP')
  cross('BRL')
  cross('MXN')
  cross('CAD')
  cross('CLP')
  cross('PEN')
  cross('ARS')
  cross('AUD')

  map.set('OTRO', mk('OTRO', copUsd))

  return Array.from(map.values())
}
