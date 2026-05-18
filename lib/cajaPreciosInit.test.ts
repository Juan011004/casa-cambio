import { describe, expect, it } from 'vitest'
import { buildPreciosCompraIniciales } from '@/lib/cajaPreciosInit'
import type { Transaccion } from '@/types/database'

describe('buildPreciosCompraIniciales', () => {
  it('prioriza precio manual del día sobre automáticos', () => {
    const out = buildPreciosCompraIniciales({
      fecha: '2026-05-17',
      divisasCodigos: ['USD', 'ARS'],
      preciosRows: [
        { moneda: 'USD', precio_compra: 9999, fecha: '2026-05-17' },
        { moneda: 'ARS', precio_compra: 50, fecha: '2026-05-16' },
      ],
      txs: [],
      cierresPrev: [],
    })
    expect(out.USD).toBe(9999)
    expect(out.ARS).toBe(50)
  })
})
