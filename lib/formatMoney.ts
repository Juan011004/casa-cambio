export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatMoneyDivisa(value: number, codigoDivisa: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const formatted = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
  return `${formatted} ${codigoDivisa}`
}

export function formatMilesEs(value: number, maxFrac = 2): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(value)
}
