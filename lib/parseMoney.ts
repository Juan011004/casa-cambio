/**
 * Acepta formatos comunes en CO:
 * - `4.234,56` (miles con punto, decimal con coma)
 * - `4234,56` (coma decimal)
 * - `4234.56` o `399.99` (punto como decimal cuando no hay coma y la parte decimal tiene 1–2 dígitos)
 */
export function parseFlexibleNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return NaN

  if (s.includes(',')) {
    const noThousands = s.replace(/\./g, '')
    const normalized = noThousands.replace(',', '.')
    const n = parseFloat(normalized)
    return Number.isFinite(n) ? n : NaN
  }

  const parts = s.split('.')
  if (parts.length === 2 && parts[0] !== '' && parts[1].match(/^\d{1,2}$/)) {
    const n = parseFloat(`${parts[0]}.${parts[1]}`)
    return Number.isFinite(n) ? n : NaN
  }

  const noThousands = s.replace(/\./g, '')
  const n = parseFloat(noThousands)
  return Number.isFinite(n) ? n : NaN
}
