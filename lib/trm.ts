export type CopPorUnidad = Record<string, number>

const FALLBACK: CopPorUnidad = {
  USD: 4120,
  EUR: 4480,
  GBP: 5220,
  BRL: 815,
  MXN: 248,
  CAD: 3020,
  CLP: 4.6,
  PEN: 1120,
  ARS: 4.5,
  AUD: 2680,
  COP: 1,
  OTRO: 4120,
}

export const TRM_DISPLAY_CODES = [
  'USD',
  'EUR',
  'MXN',
  'CAD',
  'GBP',
  'CLP',
  'BRL',
  'PEN',
  'ARS',
  'AUD',
  'OTRO',
] as const

export async function copPorUnidadMercado(): Promise<CopPorUnidad> {
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { next: { revalidate: 300 } })
    if (!r.ok) throw new Error(String(r.status))
    const j = (await r.json()) as { rates?: Record<string, number> }
    const rates = j.rates
    if (!rates?.COP) throw new Error('sin COP')

    const copUsd = rates.COP
    const out: CopPorUnidad = {
      ...FALLBACK,
      USD: copUsd,
      COP: 1,
      OTRO: copUsd,
    }
    const add = (code: keyof typeof rates) => {
      const x = rates[code]
      if (x && Number.isFinite(x) && x > 0) out[code] = copUsd / x
    }
    add('EUR')
    add('GBP')
    add('BRL')
    add('MXN')
    add('CAD')
    add('CLP')
    add('PEN')
    add('ARS')
    add('AUD')
    return out
  } catch {
    return { ...FALLBACK }
  }
}

export function montoDeudaEnCop(divisa: string, monto: number, copPorUnidad: CopPorUnidad): number {
  if (!Number.isFinite(monto)) return 0
  if (divisa === 'COP') return monto
  const rate = copPorUnidad[divisa] ?? (divisa === 'OTRO' ? copPorUnidad.OTRO ?? copPorUnidad.USD : undefined)
  if (!rate || !Number.isFinite(rate) || rate <= 0) return 0
  return monto * rate
}
