export function parseFlexibleNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return NaN
  const noThousands = s.replace(/\./g, '')
  const normalized = noThousands.replace(',', '.')
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : NaN
}
