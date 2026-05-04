import { describe, expect, it } from 'vitest'
import {
  agregarCompraVentaPorMoneda,
  cierreEstimadoSimple,
  gananciaDiaPonderadaCop,
  promedioCompraConArrastre,
} from '@/lib/cierreAuditoria'
import type { Transaccion } from '@/types/database'

describe('cierreAuditoria', () => {
  it('promedio compra ponderado del día', () => {
    const txs = [
      { moneda: 'USD', tipo: 'COMPRA' as const, monto_divisa: 100, tasa_aplicada: 4000 },
      { moneda: 'USD', tipo: 'COMPRA' as const, monto_divisa: 50, tasa_aplicada: 4100 },
    ] as Transaccion[]
    const a = agregarCompraVentaPorMoneda(txs, 'USD')
    expect(a.totalCompraMonto).toBe(150)
    expect(a.promedioCompraDia).toBeCloseTo((100 * 4000 + 50 * 4100) / 150, 6)
  })

  it('cierre estimado simple', () => {
    expect(cierreEstimadoSimple(1000, 200, 300)).toBe(900)
  })

  it('ganancia ponderada del día', () => {
    const txs = [
      { moneda: 'USD', tipo: 'COMPRA' as const, monto_divisa: 100, tasa_aplicada: 4000 },
      { moneda: 'USD', tipo: 'VENTA' as const, monto_divisa: 50, tasa_aplicada: 4200 },
    ] as Transaccion[]
    expect(gananciaDiaPonderadaCop(txs, 'USD', 0, 0)).toBeCloseTo(50 * (4200 - 4000), 4)
  })

  it('promedio compra con arrastre y venta sin compras hoy', () => {
    const txs = [
      { moneda: 'USD', tipo: 'VENTA' as const, monto_divisa: 50, tasa_aplicada: 4200 },
    ] as Transaccion[]
    expect(promedioCompraConArrastre(txs, 'USD', 100, 4000)).toBeCloseTo(4000, 4)
    expect(gananciaDiaPonderadaCop(txs, 'USD', 100, 4000)).toBeCloseTo(50 * (4200 - 4000), 4)
  })
})
