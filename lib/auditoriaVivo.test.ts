import { describe, expect, it } from 'vitest'
import type { Transaccion } from '@/types/database'
import { filasAuditoriaVivo, gananciaListaDesdeAuditoria } from '@/lib/auditoriaVivo'

describe('auditoriaVivo', () => {
  it('prioriza ganancia_cop manual sobre el cálculo por promedios', () => {
    const txs: Transaccion[] = [
      {
        id: '1',
        usuario_id: 'u',
        tipo: 'VENTA',
        moneda: 'USD',
        monto_divisa: 100,
        tasa_aplicada: 4200,
        total_cop: 420000,
        fecha: '2026-01-01',
        metodo_pago: 'Efectivo',
      },
    ]
    const prev = new Map([['USD', { saldoAnterior: 0, promedioAnterior: 4000 }]])
    const overrides = new Map([['USD', { ganancia_cop: 99_999 }]])
    const filas = filasAuditoriaVivo(txs, prev, ['USD'], overrides)
    expect(filas[0]?.gananciaCop).toBe(99_999)
    const lista = gananciaListaDesdeAuditoria(txs, [], prev, overrides)
    expect(lista).toEqual([{ codigo: 'USD', valor: 99_999 }])
  })
})
