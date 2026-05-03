import { describe, expect, it } from 'vitest'
import {
  agregarCompraVentaPorMoneda,
  costoPromedioPonderadoVenta,
  cierreEstimadoOperativo,
  gananciaNetaCopVenta,
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
    expect(a.costoCompraCop).toBe(100 * 4000 + 50 * 4100)
    expect(a.promedioCompraDia).toBeCloseTo(a.costoCompraCop / 150, 6)
  })

  it('cierre estimado operativo', () => {
    expect(
      cierreEstimadoOperativo({
        aperturaCaja: 1000,
        compras: 200,
        ventas: 300,
        debenDia: 50,
        deboDia: 25,
      })
    ).toBe(1000 + 200 - 300 - 50 + 25)
  })

  it('ganancia con WAC mezcla apertura y compras', () => {
    const wac = costoPromedioPonderadoVenta({
      montoInicial: 100,
      promedioInicial: 4000,
      totalCompraMonto: 100,
      costoCompraCop: 100 * 4200,
      promedioCompraDia: 4200,
    })
    expect(wac).toBeCloseTo((100 * 4000 + 100 * 4200) / 200, 6)
    const g = gananciaNetaCopVenta({
      totalVentaMonto: 50,
      promedioVentaDia: 4500,
      costoUnitarioWac: wac,
    })
    expect(g).toBeCloseTo(50 * (4500 - wac), 4)
  })
})
