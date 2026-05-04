'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { dayBoundsLocal, formatCOP, formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { gananciaDiaPonderadaCop } from '@/lib/cierreAuditoria'
import { exportCierresDiariosExcel } from '@/lib/exportCierresExcel'
import { obtenerTrmMercado } from '@/app/actions/trm'
import { TRM_TICKER_ORDER, type TrmMercadoFila } from '@/lib/trm-ticker'
import type { CierreDiarioAuditoria, Transaccion } from '@/types/database'
import type { CopPorUnidad } from '@/lib/trm'

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
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

function sumTxMontoDivisa(rows: Transaccion[], tipo: 'COMPRA' | 'VENTA'): { codigo: string; valor: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.tipo !== tipo) continue
    const k = r.moneda
    map.set(k, (map.get(k) ?? 0) + Number(r.monto_divisa))
  }
  return Array.from(map.entries())
    .filter(([, v]) => Math.abs(v) > 1e-10)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, valor]) => ({ codigo, valor }))
}

function gananciaListaDesdeTx(rows: Transaccion[]): { codigo: string; valor: number }[] {
  const codes = new Set<string>()
  for (const r of rows) codes.add(r.moneda)
  const out: { codigo: string; valor: number }[] = []
  for (const codigo of Array.from(codes).sort()) {
    const g = gananciaDiaPonderadaCop(rows, codigo)
    if (Math.abs(g) > 1e-6) out.push({ codigo, valor: g })
  }
  return out
}

function sumDeudasPendientes(rows: { divisa: string; monto: number }[]): { codigo: string; valor: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (r.divisa === 'COP') continue
    m.set(r.divisa, (m.get(r.divisa) ?? 0) + r.monto)
  }
  return Array.from(m.entries())
    .filter(([, v]) => Math.abs(v) > 1e-10)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, valor]) => ({ codigo, valor }))
}

function ListaDivisaCompacta({ items, dec = 4 }: { items: { codigo: string; valor: number }[]; dec?: number }) {
  if (!items.length) return <p className="mt-2 text-center text-sm font-medium text-black/40">—</p>
  return (
    <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-center">
      {items.map((x) => (
        <li key={x.codigo} className="flex justify-center gap-3 font-mono text-sm tabular-nums text-black/85">
          <span className="font-bold">{x.codigo}</span>
          <span>{formatMilesEs(x.valor, dec)}</span>
        </li>
      ))}
    </ul>
  )
}

function TarjetaHero({
  titulo,
  valorGrande,
  items,
  decItems = 4,
  gradient,
  pie,
}: {
  titulo: string
  valorGrande: string
  items: { codigo: string; valor: number }[]
  decItems?: number
  gradient: string
  pie?: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 p-5 shadow-xl ${gradient}`}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
      <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-black/55">{titulo}</h2>
      <p className="mt-3 text-center text-5xl font-black leading-none tracking-tight text-black tabular-nums sm:text-6xl">
        {valorGrande}
      </p>
      {pie ? <p className="mt-1 text-center text-[10px] font-semibold uppercase text-black/45">{pie}</p> : null}
      <ListaDivisaCompacta items={items} dec={decItems} />
    </div>
  )
}

export default function DashboardPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [fechaDia, setFechaDia] = useState(() => fechaLocalYYYYMMDD())
  const [loading, setLoading] = useState(true)
  const [txRows, setTxRows] = useState<Transaccion[]>([])
  const [debenRows, setDebenRows] = useState<{ divisa: string; monto: number }[]>([])
  const [deboRows, setDeboRows] = useState<{ divisa: string; monto: number }[]>([])
  const [rates, setRates] = useState<CopPorUnidad | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [trmFilas, setTrmFilas] = useState<TrmMercadoFila[]>([])
  const [ultimaTrm, setUltimaTrm] = useState<string | null>(null)
  const [cierresRows, setCierresRows] = useState<CierreDiarioAuditoria[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { desde, hastaExclusive } = dayBoundsLocal(fechaDia)

    let txQuery = supabase
      .from('transacciones')
      .select('*')
      .gte('fecha', desde)
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })
    if (user?.id) txQuery = txQuery.eq('usuario_id', user.id)

    let debenQ = supabase.from('deudas').select('divisa,monto').eq('tipo', 'DEBEN').eq('estado', 'PENDIENTE')
    let deboQ = supabase.from('deudas').select('divisa,monto').eq('tipo', 'DEBO').eq('estado', 'PENDIENTE')
    let cierresQ = supabase.from('cierres_diarios').select('*').eq('fecha', fechaDia)
    if (user?.id) {
      debenQ = debenQ.eq('usuario_id', user.id)
      deboQ = deboQ.eq('usuario_id', user.id)
      cierresQ = cierresQ.eq('usuario_id', user.id)
    }

    const [txRes, ndRes, dbRes, cRes] = await Promise.all([txQuery, debenQ, deboQ, cierresQ])

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
    setCierresRows((cRes.error ? [] : cRes.data) as CierreDiarioAuditoria[])
    setLoading(false)
  }, [supabase, fechaDia])

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

  const comprasLista = useMemo(() => sumTxMontoDivisa(txRows, 'COMPRA'), [txRows])
  const ventasLista = useMemo(() => sumTxMontoDivisa(txRows, 'VENTA'), [txRows])
  const gananciaLista = useMemo(() => gananciaListaDesdeTx(txRows), [txRows])
  const nosDebenLista = useMemo(() => sumDeudasPendientes(debenRows), [debenRows])
  const debemosLista = useMemo(() => sumDeudasPendientes(deboRows), [deboRows])

  const totalComprasCop = useMemo(
    () => txRows.filter((t) => t.tipo === 'COMPRA').reduce((s, t) => s + Number(t.total_cop), 0),
    [txRows]
  )
  const totalVentasCop = useMemo(
    () => txRows.filter((t) => t.tipo === 'VENTA').reduce((s, t) => s + Number(t.total_cop), 0),
    [txRows]
  )
  const totalGananciaCop = useMemo(() => {
    const codes = Array.from(new Set(txRows.map((t) => t.moneda)))
    let s = 0
    for (const c of codes) s += gananciaDiaPonderadaCop(txRows, c)
    return s
  }, [txRows])

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

  const filasPorCodigo = useMemo(() => {
    const m = new Map<string, TrmMercadoFila>()
    for (const f of trmFilas) m.set(f.codigo, f)
    return m
  }, [trmFilas])

  const recientes = useMemo(() => txRows.slice(0, 10), [txRows])

  const heroCompra = loading ? '…' : formatCOP(totalComprasCop)
  const heroVenta = loading ? '…' : formatCOP(totalVentasCop)
  const heroGanancia = loading ? '…' : formatMilesEs(totalGananciaCop, 0)
  const heroDeben = loading ? '…' : String(nosDebenLista.length)
  const heroDebo = loading ? '…' : String(debemosLista.length)

  return (
    <main className="space-y-5 text-[13px] text-black">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-lg font-bold">Inicio</h1>
        <input
          type="date"
          value={fechaDia}
          onChange={(e) => setFechaDia(e.target.value)}
          className="input-field min-h-[40px] max-w-[200px] text-[13px]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <TarjetaHero
          titulo="Compra"
          valorGrande={heroCompra}
          items={loading ? [] : comprasLista}
          gradient="border-sky-300/80 bg-gradient-to-br from-sky-50 via-white to-sky-100/90"
        />
        <TarjetaHero
          titulo="Venta"
          valorGrande={heroVenta}
          items={loading ? [] : ventasLista}
          gradient="border-amber-300/80 bg-gradient-to-br from-amber-50 via-white to-amber-100/90"
        />
        <TarjetaHero
          titulo="Ganancia"
          valorGrande={heroGanancia}
          items={loading ? [] : gananciaLista}
          decItems={0}
          gradient="border-emerald-400/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/90"
        />
        <TarjetaHero
          titulo="Me deben"
          valorGrande={heroDeben}
          items={loading ? [] : nosDebenLista}
          pie="Posiciones con saldo"
          gradient="border-violet-300/80 bg-gradient-to-br from-violet-50 via-white to-violet-100/90"
        />
        <TarjetaHero
          titulo="Debo"
          valorGrande={heroDebo}
          items={loading ? [] : debemosLista}
          pie="Posiciones con saldo"
          gradient="border-rose-300/80 bg-gradient-to-br from-rose-50 via-white to-rose-100/90"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 shadow-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">TRM</h2>
          <span className="text-xs text-slate-500">{ratesLoading ? '…' : textoActualizado(ultimaTrm)}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TRM_TICKER_ORDER.map((code) => {
            const f = filasPorCodigo.get(code)
            const v = f?.valor_cop ?? copMap[code]
            const show = !ratesLoading && Number(v) > 0
            return (
              <div
                key={code}
                className="min-w-[92px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center shadow-sm"
              >
                <p className="text-base leading-none" aria-hidden>
                  {FLAGS[code] ?? '💱'}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-800">{code}</p>
                <p className="font-mono text-[11px] font-semibold tabular-nums">{show ? formatCOP(Number(v)) : '—'}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
        <div className="border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-bold">Operaciones</h2>
        </div>
        {loading ? (
          <p className="p-3 text-sm">…</p>
        ) : recientes.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="px-2 py-2 font-semibold text-slate-700">Hora</th>
                  <th className="px-2 py-2 font-semibold text-slate-700">Tipo</th>
                  <th className="px-2 py-2 font-semibold text-slate-700">Divisa</th>
                  <th className="px-2 py-2 text-right font-semibold text-slate-700">Monto</th>
                  <th className="px-2 py-2 text-right font-semibold text-slate-700">Tasa</th>
                  <th className="px-2 py-2 text-right font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="px-2 py-1.5 font-mono text-slate-800">
                      {new Intl.DateTimeFormat('es-CO', { timeStyle: 'short' }).format(new Date(tx.fecha))}
                    </td>
                    <td className="px-2 py-1.5 font-bold uppercase">{tx.tipo}</td>
                    <td className="px-2 py-1.5 font-medium">{tx.moneda}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatMilesEs(Number(tx.monto_divisa), 4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatMilesEs(tx.tasa_aplicada, 2)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatCOP(tx.total_cop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-bold">Historial de cierres</h2>
          <button
            type="button"
            onClick={() => exportCierresDiariosExcel(cierresRows, fechaDia)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Excel
          </button>
        </div>
        {loading ? (
          <p className="p-3 text-sm">…</p>
        ) : cierresRows.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-center text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="px-2 py-2 font-bold text-slate-700">Fecha</th>
                  <th className="px-2 py-2 font-bold text-slate-700">Moneda</th>
                  <th className="px-2 py-2 font-bold text-slate-700">Apertura</th>
                  <th className="px-2 py-2 font-bold text-slate-700">Promedio compra</th>
                  <th className="px-2 py-2 font-bold text-slate-700">Promedio venta</th>
                  <th className="px-2 py-2 font-bold text-slate-700">Estimado</th>
                  <th className="px-2 py-2 font-bold text-slate-700">Manual</th>
                  <th className="px-2 py-2 font-bold text-slate-700">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {cierresRows.map((r) => {
                  const est = Number(r.cierre_estimado)
                  const man = Number(r.cierre_manual)
                  const delta = est - man
                  const deltaClass = delta >= 0 ? 'text-blue-700' : 'text-red-700'
                  const pc = Number(r.promedio_compra ?? 0)
                  const pv = Number(r.promedio_venta ?? 0)
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 font-mono text-slate-800">{r.fecha}</td>
                      <td className="px-2 py-1.5 font-bold">{r.moneda}</td>
                      <td className="px-2 py-1.5 font-mono tabular-nums">{formatMilesEs(Number(r.apertura), 2)}</td>
                      <td className="px-2 py-1.5 font-mono tabular-nums">{formatMilesEs(pc, 2)}</td>
                      <td className="px-2 py-1.5 font-mono tabular-nums">{formatMilesEs(pv, 2)}</td>
                      <td className="px-2 py-1.5 font-mono tabular-nums">{formatMilesEs(est, 2)}</td>
                      <td className="px-2 py-1.5 font-mono font-semibold tabular-nums">{formatMilesEs(man, 2)}</td>
                      <td className={`px-2 py-1.5 font-mono font-bold tabular-nums ${deltaClass}`}>
                        {formatMilesEs(delta, 2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        <a href="/caja" className="font-semibold underline">
          Caja
        </a>{' '}
        ·{' '}
        <a href="/historial" className="font-semibold underline">
          Historial
        </a>
      </p>
    </main>
  )
}
