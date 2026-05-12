import { describe, expect, it } from 'vitest'
import { saldoPromedioPorMonedaDesdeCierres } from '@/lib/ultimoCierre'

describe('saldoPromedioPorMonedaDesdeCierres', () => {
  it('mismo día calendario: gana la fila con created_at más reciente', () => {
    const rows = [
      {
        moneda: 'USD',
        fecha: '2026-05-10',
        cierre_manual: 100,
        promedio_compra: 4000,
        promedio_compra_acumulado: 4000,
        id: 'a',
        created_at: '2026-05-10T08:00:00Z',
      },
      {
        moneda: 'USD',
        fecha: '2026-05-10T12:00:00.000Z',
        cierre_manual: 250,
        promedio_compra: 4100,
        promedio_compra_acumulado: 4100,
        id: 'b',
        created_at: '2026-05-10T18:00:00Z',
      },
    ]
    const m = saldoPromedioPorMonedaDesdeCierres(rows)
    expect(m.get('USD')?.saldoAnterior).toBe(250)
    expect(m.get('USD')?.promedioAnterior).toBe(4100)
  })

  it('prefiere día calendario mayor aunque el ISO “string” sea menor', () => {
    const rows = [
      {
        moneda: 'EUR',
        fecha: '2026-05-09T23:59:59Z',
        cierre_manual: 10,
        promedio_compra: 100,
        promedio_compra_acumulado: 100,
        id: '1',
        created_at: '2026-05-09T20:00:00Z',
      },
      {
        moneda: 'EUR',
        fecha: '2026-05-10',
        cierre_manual: 20,
        promedio_compra: 200,
        promedio_compra_acumulado: 200,
        id: '2',
        created_at: '2026-05-10T10:00:00Z',
      },
    ]
    const m = saldoPromedioPorMonedaDesdeCierres(rows)
    expect(m.get('EUR')?.saldoAnterior).toBe(20)
  })
})
