'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { formatCOP, formatMilesEs, isoTimestampForPostgrestFilter } from '@/lib/utils'
import { obtenerTrmMercado } from '@/app/actions/trm'
import { TRM_TICKER_ORDER, type TrmMercadoFila } from '@/lib/trm-ticker'
import type { Transaccion } from '@/types/database'
import { montoDeudaEnCop, type CopPorUnidad } from '@/lib/trm'

const FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  CAD: '🇨🇦',
  BRL: '🇧🇷',
  MXN: '🇲🇽',
  CLP: '🇨🇱',
  PEN: '🇵🇪',
  ARS: '🇦🇷',
  AUD: '🇦🇺',
}

function textoActualizado(iso: string | null) {
  if (!iso) return 'Sin sincronizar aún'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} minuto${m === 1 ? '' : 's'}`
  const h = Math.floor(m / 60)
  if (h < 48) return `hace ${h} hora${h === 1 ? '' : 's'}`
  const d = Math.floor(h / 24)
  return `hace ${d} día${d === 1 ? '' : 's'}`
}

export default function DashboardPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [loading, setLoading] = useState(true)
  const [txRows, setTxRows] = useState<Transaccion[]>([])
  const [debenRows, setDebenRows] = useState<{ divisa: string; monto: number }[]>([])
  const [deboRows, setDeboRows] = useState<{ divisa: string; monto: number }[]>([])
  const [rates, setRates] = useState<CopPorUnidad | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [trmFilas, setTrmFilas] = useState<TrmMercadoFila[]>([])
  const [ultimaTrm, setUltimaTrm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const desde = isoTimestampForPostgrestFilter(today)

    let txQuery = supabase.from('transacciones').select('*').gte('fecha', desde).order('fecha', { ascending: false })
    if (user?.id) txQuery = txQuery.eq('usuario_id', user.id)

    let debenQ = supabase.from('deudas').select('divisa,monto').eq('tipo', 'DEBEN').eq('estado', 'PENDIENTE')
    let deboQ = supabase.from('deudas').select('divisa,monto').eq('tipo', 'DEBO').eq('estado', 'PENDIENTE')
    if (user?.id) {
      debenQ = debenQ.eq('usuario_id', user.id)
      deboQ = deboQ.eq('usuario_id', user.id)
    }

    const [txRes, ndRes, dbRes] = await Promise.all([txQuery, debenQ, deboQ])

    setTxRows((txRes.data ?? []) as Transaccion[])
    setDebenRows(
      (ndRes.data ?? []).map((r) => ({
        divisa: String((r as Record<string, unknown>).divisa),
        monto: Number((r as Record<string, unknown>).monto),
      }))
    )
    setDeboRows(
      (dbRes.data ?? []).map((r) => ({
        divisa: String((r as Record<string, unknown>).divisa),
        monto: Number((r as Record<string, unknown>).monto),
      }))
    )
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setRatesLoading(true)
      const res = await obtenerTrmMercado()
      if (cancelled) return
      setRates(res.rates)
      setTrmFilas(res.filas)
      setUltimaTrm(res.ultimaActualizacion)
      setRatesLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ventasCop = useMemo(
    () => txRows.filter((r) => r.tipo === 'VENTA').reduce((s, r) => s + r.total_cop, 0),
    [txRows]
  )
  const comprasCop = useMemo(
    () => txRows.filter((r) => r.tipo === 'COMPRA').reduce((s, r) => s + r.total_cop, 0),
    [txRows]
  )

  const gananciaDiaCop = useMemo(
    () =>
      txRows.filter((r) => r.tipo === 'VENTA').reduce((s, r) => s + (Number(r.ganancia_cop) || 0), 0),
    [txRows]
  )

  const copMap = rates ?? {
    USD: 0,
    EUR: 0,
    GBP: 0,
    BRL: 0,
    MXN: 0,
    CAD: 0,
    CLP: 0,
    PEN: 0,
    ARS: 0,
    AUD: 0,
    COP: 1,
    OTRO: 0,
  }

  const nosDebenCop = useMemo(
    () => debenRows.reduce((s, r) => s + montoDeudaEnCop(r.divisa, r.monto, copMap), 0),
    [debenRows, copMap]
  )
  const debemosCop = useMemo(
    () => deboRows.reduce((s, r) => s + montoDeudaEnCop(r.divisa, r.monto, copMap), 0),
    [deboRows, copMap]
  )

  const filasPorCodigo = useMemo(() => {
    const m = new Map<string, TrmMercadoFila>()
    for (const f of trmFilas) m.set(f.codigo, f)
    return m
  }, [trmFilas])

  const recientes = useMemo(() => txRows.slice(0, 10), [txRows])

  return (
    <main className="space-y-4 text-[13px] text-black">
      <h1 className="text-base font-semibold tracking-tight text-black">Inicio</h1>

      <section className="card-pro border-2 border-emerald-600 bg-emerald-50/90 p-4 shadow-sm">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900">Ganancia total del día</h3>
        <p className="mt-1.5 text-[22px] font-bold tabular-nums leading-tight text-emerald-900">
          {loading ? '…' : formatCOP(gananciaDiaCop)}
        </p>
        <p className="mt-1 text-[11px] text-emerald-800">Suma de ganancia en ventas (vs. último precio de compra).</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">Total compras hoy (COP)</h3>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-black">{loading ? '…' : formatCOP(comprasCop)}</p>
        </div>
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">Total ventas hoy (COP)</h3>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-black">{loading ? '…' : formatCOP(ventasCop)}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">¿Quién me debe? (total COP)</h3>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-black">
            {loading || ratesLoading ? '…' : formatCOP(nosDebenCop)}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">Solo pendientes · TRM mercado.</p>
        </div>
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">¿A quién le debo? (total COP)</h3>
          <p className="mt-1.5 text-lg font-bold tabular-nums text-black">
            {loading || ratesLoading ? '…' : formatCOP(debemosCop)}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">Solo pendientes · TRM mercado.</p>
        </div>
      </section>

      <section className="card-pro border border-slate-200 p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">Mercado en vivo (TRM)</h2>
          <p className="text-[10px] text-slate-500">
            Actualizado: {ratesLoading ? '…' : textoActualizado(ultimaTrm)}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TRM_TICKER_ORDER.map((code) => {
            const f = filasPorCodigo.get(code)
            const v = f?.valor_cop ?? copMap[code]
            const show = !ratesLoading && Number(v) > 0
            return (
              <div
                key={code}
                className="min-w-[104px] shrink-0 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2 text-center"
              >
                <p className="text-lg leading-none" aria-hidden>
                  {FLAGS[code] ?? '💱'}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-700">{code}</p>
                <p className="truncate text-[10px] text-slate-600">{f?.nombre ?? '—'}</p>
                <p className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-black">
                  {show ? formatCOP(Number(v)) : '—'}
                </p>
                <p className="mt-1 text-[9px] leading-tight text-slate-500">1 {code} ≈ COP</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card-pro overflow-hidden border border-slate-200 shadow-sm">
        <div className="border-b border-slate-200 px-3 py-2">
          <h3 className="text-[12px] font-semibold text-black">Operaciones recientes (hoy)</h3>
          <p className="text-[10px] text-slate-600">Últimas {Math.min(10, recientes.length)} movimientos del día.</p>
        </div>
        {loading ? (
          <p className="p-3 text-[12px] text-slate-700">Cargando…</p>
        ) : recientes.length === 0 ? (
          <p className="p-3 text-[12px] text-slate-700">Sin movimientos hoy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="table-header">Hora</th>
                  <th className="table-header">Tipo</th>
                  <th className="table-header">Divisa</th>
                  <th className="table-header text-right">Monto</th>
                  <th className="table-header text-right">Tasa</th>
                  <th className="table-header text-right">Total COP</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="table-cell text-slate-800">
                      {new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(new Date(tx.fecha))}
                    </td>
                    <td className="table-cell font-semibold uppercase text-blue-800">{tx.tipo}</td>
                    <td className="table-cell font-medium">{tx.moneda}</td>
                    <td className="table-cell text-right font-mono">{formatMilesEs(Number(tx.monto_divisa), 4)}</td>
                    <td className="table-cell text-right font-mono">{formatMilesEs(tx.tasa_aplicada, 2)}</td>
                    <td className="table-cell text-right font-mono font-semibold">{formatCOP(tx.total_cop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-slate-500">
        Caja diaria: menú <span className="font-semibold">Caja</span> · Historial completo:{' '}
        <a href="/historial" className="font-semibold text-blue-700 underline">
          Historial
        </a>
        .
      </p>
    </main>
  )
}
