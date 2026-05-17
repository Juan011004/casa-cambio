import { describe, expect, it } from 'vitest'
import { sumGananciaAcumuladaCombinada } from '@/lib/gananciaCierres'

describe('sumGananciaAcumuladaCombinada', () => {
  it('prioriza ganancias_dia del balance sobre cierres del mismo día', () => {
    const total = sumGananciaAcumuladaCombinada(
      [
        { fecha: '2026-05-15', ganancia_calculada: 100 },
        { fecha: '2026-05-16', ganancia_calculada: 200 },
      ],
      [{ fecha: '2026-05-16', ganancias_dia: 999 }],
      '2026-05-16'
    )
    expect(total).toBe(1099)
  })
})
