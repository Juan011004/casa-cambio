'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Package } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { dayBoundsLocal, formatCOP, formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { gananciaDiaPonderadaCop } from '@/lib/cierreAuditoria'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'
import { exportCierresDiariosExcel } from '@/lib/exportCierresExcel'
import { obtenerTrmMercado } from '@/app/actions/trm'
import { TRM_TICKER_ORDER, type TrmMercadoFila } from '@/lib/trm-ticker'
import { CargaInicialDialog } from '@/components/CargaInicialDialog'
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

function gananciaListaDesdeTx(
  rows: Transaccion[],
  prevPorMoneda: Map<string, { saldoAnterior: number; promedioAnterior: number }>
): { codigo: string; valor: number }[] {
  const codes = new Set<string>()
  for (const r of rows) codes.add(r.moneda)
  const out: { codigo: string; valor: number }[] = []
  for (const codigo of Array.from(codes).sort()) {
    const p = prevPorMoneda.get(codigo) ?? { saldoAnterior: 0, promedioAnterior: 0 }
    const g = gananciaDiaPonderadaCop(rows, codigo, p.saldoAnterior, p.promedioAnterior)
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

function TarjetaCompacta({
  titulo,
  items,
  decItems = 4,
  accent,
}: {
  titulo: string
  items: { codigo: string; valor: number }[]
  decItems?: number
  accent: 'emerald' | 'rose' | 'sky' | 'violet'
}) {
  const bar =
    accent === 'emerald'
      ? 'border-l-emerald-500'
      : accent === 'rose'
        ? 'border-l-rose-500'
        : accent === 'sky'
          ? 'border-l-sky-500'
          : 'border-l-violet-500'
  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${bar} border-l-[4px]`}>
      <div className="min-h-[5.5rem] bg-slate-50/40 px-2.5 py-2 pl-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{titulo}</h2>
        {!items.length ? (
          <p className="mt-2 text-[11px] text-slate-400">—</p>
        ) : (
          <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
            {items.map((x) => (
              <li key={x.codigo} className="flex justify-between gap-2 font-mono text-[11px] tabular-nums text-slate-800">
                <span className="font-semibold">{x.codigo}</span>
                <span>{formatMilesEs(x.valor, decItems)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
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
  const [cierresPrevRows, setCierresPrevRows] = useState<CierreRowParaArrastre[]>([])
  const [cargaInicialOpen, setCargaInicialOpen] = useState(false)

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
    let cierresPrevQ = supabase
      .from('cierres_diarios')
      .select('moneda,fecha,cierre_manual,promedio_compra,promedio_compra_acumulado')
      .lt('fecha', fechaDia)
    if (user?.id) {
      debenQ = debenQ.eq('usuario_id', user.id)
      deboQ = deboQ.eq('usuario_id', user.id)
      cierresQ = cierresQ.eq('usuario_id', user.id)
      cierresPrevQ = cierresPrevQ.eq('usuario_id', user.id)
    }

    const [txRes, ndRes, dbRes, cRes, cPrevRes] = await Promise.all([txQuery, debenQ, deboQ, cierresQ, cierresPrevQ])

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
    setCierresPrevRows((cPrevRes.error ? [] : cPrevRes.data) as CierreRowParaArrastre[])
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
  const ultimoCierrePorMoneda = useMemo(() => saldoPromedioPorMonedaDesdeCierres(cierresPrevRows), [cierresPrevRows])

  const gananciaLista = useMemo(
    () => gananciaListaDesdeTx(txRows, ultimoCierrePorMoneda),
    [txRows, ultimoCierrePorMoneda]
  )
  const nosDebenLista = useMemo(() => sumDeudasPendientes(debenRows), [debenRows])
  const debemosLista = useMemo(() => sumDeudasPendientes(deboRows), [deboRows])

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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <TarjetaCompacta titulo="Compra" items={loading ? [] : comprasLista} accent="sky" />
        <TarjetaCompacta titulo="Venta" items={loading ? [] : ventasLista} accent="rose" />
        <TarjetaCompacta titulo="Ganancia" items={loading ? [] : gananciaLista} decItems={0} accent="emerald" />
        <TarjetaCompacta titulo="Me deben" items={loading ? [] : nosDebenLista} accent="violet" />
        <TarjetaCompacta titulo="Debo" items={loading ? [] : debemosLista} accent="rose" />
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCargaInicialOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              <Package className="h-3.5 w-3.5" aria-hidden />
              Carga inicial
            </button>
            <button
              type="button"
              onClick={() => exportCierresDiariosExcel(cierresRows, fechaDia)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Excel
            </button>
          </div>
        </div>
        {loading ? (
          <p className="p-3 text-sm">…</p>
        ) : cierresRows.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1520px] border-collapse text-center text-[10px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="sticky left-0 z-10 bg-slate-100 px-1.5 py-2 font-bold text-slate-700">Fecha</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Moneda</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Origen</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Cant. inicial</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Prom. anterior</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Total comprado</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Nuevo prom. compra</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Total vendido</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Prom. venta</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Ganancia</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Estimado</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Manual</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {cierresRows.map((r) => {
                  const est = Number(r.cierre_estimado)
                  const man = Number(r.cierre_manual)
                  const delta = man - est
                  const deltaClass = delta >= 0 ? 'text-blue-700' : 'text-red-700'
                  const np = Number(r.promedio_compra_acumulado ?? r.promedio_compra ?? 0)
                  const pv = Number(r.promedio_venta ?? 0)
                  const pa = Number(r.promedio_anterior ?? 0)
                  const tc = Number(r.total_comprado_divisa ?? 0)
                  const tv = Number(r.total_vendido_divisa ?? 0)
                  const origen = r.origen ?? 'OPERATIVO'
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="sticky left-0 z-10 bg-white px-1.5 py-1.5 font-mono text-slate-800">{r.fecha}</td>
                      <td className="px-1.5 py-1.5 font-bold">{r.moneda}</td>
                      <td className="px-1.5 py-1.5">
                        {origen === 'CARGA_INICIAL' ? (
                          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-950">
                            Inicial
                          </span>
                        ) : (
                          <span className="text-slate-500">Operativo</span>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(Number(r.apertura), 4)}</td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(pa, 2)}</td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(tc, 4)}</td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(np, 2)}</td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(tv, 4)}</td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(pv, 2)}</td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(Number(r.ganancia_calculada), 0)}</td>
                      <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(est, 4)}</td>
                      <td className="px-1.5 py-1.5 font-mono font-semibold tabular-nums">{formatMilesEs(man, 4)}</td>
                      <td className={`px-1.5 py-1.5 font-mono font-bold tabular-nums ${deltaClass}`}>
                        {formatMilesEs(delta, 4)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CargaInicialDialog
        open={cargaInicialOpen}
        onClose={() => setCargaInicialOpen(false)}
        onGuardado={() => void load()}
      />

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
