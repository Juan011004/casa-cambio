import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export { formatCOP, formatMoneyDivisa, formatMilesEs } from '@/lib/formatMoney'

export const formatUSD = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)

export function formatDate(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

export function isoTimestampForPostgrestFilter(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export function fechaLocalYYYYMMDD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Límites del día local `YYYY-MM-DD` para filtros PostgREST (fecha >= desde y fecha < hastaExclusive). */
export function dayBoundsLocal(fechaYYYYMMDD: string): { desde: string; hastaExclusive: string } {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const desde = new Date(y, m - 1, d, 0, 0, 0, 0)
  const hastaExc = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
  return {
    desde: isoTimestampForPostgrestFilter(desde),
    hastaExclusive: isoTimestampForPostgrestFilter(hastaExc),
  }
}

/** Suma o resta días a `YYYY-MM-DD` en calendario local (mismo criterio que `dayBoundsLocal`). */
export function addDaysYYYYMMDD(fechaYYYYMMDD: string, deltaDays: number): string {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}
