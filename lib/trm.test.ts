import { describe, expect, it } from 'vitest'
import { montoDeudaEnCop } from '@/lib/trm'

describe('montoDeudaEnCop', () => {
  const rates = {
    USD: 4000,
    EUR: 4400,
    COP: 1,
    OTRO: 4000,
  }

  it('convierte USD a COP', () => {
    expect(montoDeudaEnCop('USD', 100, rates)).toBe(400000)
  })

  it('devuelve 0 si la divisa no tiene tasa', () => {
    expect(montoDeudaEnCop('XYZ', 10, rates)).toBe(0)
  })
})
