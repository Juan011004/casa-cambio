import { describe, expect, it } from 'vitest'
import { parseFlexibleNumber } from '@/lib/parseMoney'

describe('parseFlexibleNumber', () => {
  it('formato CO con miles y coma decimal', () => {
    expect(parseFlexibleNumber('4.234,56')).toBeCloseTo(4234.56, 5)
  })

  it('punto como decimal cuando no hay coma (1–2 decimales)', () => {
    expect(parseFlexibleNumber('3999.50')).toBeCloseTo(3999.5, 5)
    expect(parseFlexibleNumber('4200,5')).toBeCloseTo(4200.5, 5)
  })
})
