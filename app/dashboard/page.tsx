'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import {
  addDaysYYYYMMDD,
  dayBoundsLocal,
  formatCOP,
  formatMilesEs,
  fechaLocalYYYYMMDD,
} from '@/lib/utils'
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
  if (!iso) return 'Sin sincronizar aún'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'hace un momento'
  if (m < 60) return `hace ${m} minuto${m === 1 ? '' : 's'}`
  const h = Math.floor(m / 60)
  if (h < 48) return `hace ${h} hora${h === 1 ? '' : 's'}`
  const d = Math.floor(h / 24)
  return `hace ${d} día${d === 1 ? '' : 's'}`
}

function sumTxMontoDivisa(rows: Transaccion[], tipo: 'COMPRA' | 'VENTA'): { codigo: string; valor: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (r.tipo !== tipo) continue
    const k = r.moneda
    m.set(k, (m.get(k) ?? 0) + Number(r.monto_divisa))
  }
  return Array.from(m.entries())
    .filter(([, v]) => Math.abs(v) > 1e-10)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, valor]) => ({ codigo, valor }))
}

function gananciaPorDivisa(rows: Transaccion[]): { codigo: string; valorCop: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (r.tipo !== 'VENTA') continue
    const k = r.moneda
    const g = Number(r.ganancia_cop) || 0
    m.set(k, (m.get(k) ?? 0) + g)
  }
  return Array.from(m.entries())
    .filter(([, v]) => Math.abs(v) > 1e-6)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, valorCop]) => ({ codigo, valorCop }))
}

function sumDeudasPendientes(
  rows: { divisa: string; monto: number }[]
): { codigo: string; valor: number }[] {
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

function ListaMontosDivisa({ items, dec = 4 }: { items: { codigo: string; valor: number }[]; dec?: number }) {
  if (!items.length) {
    return <p className="mt-1 text-[11px] text-slate-500">Sin movimientos en este día.</p>
  }
  return (
    <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto pr-1">
      {items.map((x) => (
        <li key={x.codigo} className="flex justify-between gap-2 font-mono text-[11px] tabular-nums">
          <span className="font-semibold text-slate-700">{x.codigo}</span>
          <span>{formatMilesEs(x.valor, dec)}</span>
        </li>
      ))}
    </ul>
  )
}

function ListaGananciaDivisa({ items }: { items: { codigo: string; valorCop: number }[] }) {
  if (!items.length) {
    return <p className="mt-1 text-[11px] text-slate-500">Sin ventas con ganancia registrada.</p>
  }
  return (
    <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto pr-1">
      {items.map((x) => (
        <li key={x.codigo} className="flex justify-between gap-2 font-mono text-[11px] tabular-nums">
          <span className="font-semibold text-slate-700">{x.codigo}</span>
          <span className="text-emerald-900">{formatCOP(x.valorCop)}</span>
        </li>
      ))}
    </ul>
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
  const [cierresAyerRows, setCierresAyerRows] = useState<CierreDiarioAuditoria[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { desde, hastaExclusive } = dayBoundsLocal(fechaDia)
    const fechaAyer = addDaysYYYYMMDD(fechaDia, -1)

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
    let cierresAyerQ = supabase.from('cierres_diarios').select('*').eq('fecha', fechaAyer)
    if (user?.id) {
      debenQ = debenQ.eq('usuario_id', user.id)
      deboQ = deboQ.eq('usuario_id', user.id)
      cierresQ = cierresQ.eq('usuario_id', user.id)
      cierresAyerQ = cierresAyerQ.eq('usuario_id', user.id)
    }

    const [txRes, ndRes, dbRes, cRes, cAyerRes] = await Promise.all([
      txQuery,
      debenQ,
      deboQ,
      cierresQ,
      cierresAyerQ,
    ])

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
    setCierresAyerRows((cAyerRes.error ? [] : cAyerRes.data) as CierreDiarioAuditoria[])
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
  const gananciaLista = useMemo(() => gananciaPorDivisa(txRows), [txRows])
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

  const divisasMasMovimiento = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of txRows) {
      const k = r.moneda
      const v = Math.abs(Number(r.monto_divisa)) || 0
      m.set(k, (m.get(k) ?? 0) + v)
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([codigo]) => codigo)
  }, [txRows])

  const cierresAyerPorMoneda = useMemo(() => {
    const map = new Map<string, CierreDiarioAuditoria>()
    for (const r of cierresAyerRows) map.set(r.moneda, r)
    return map
  }, [cierresAyerRows])

  const onExportCierres = () => {
    exportCierresDiariosExcel(cierresRows, fechaDia)
  }

  return (
    <main className="space-y-4 text-[13px] text-black">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-base font-semibold tracking-tight text-black">Inicio</h1>
        <div>
          <label className="label text-[11px]" htmlFor="dash-fecha">
            Día de las estadísticas
          </label>
          <input
            id="dash-fecha"
            type="date"
            value={fechaDia}
            onChange={(e) => setFechaDia(e.target.value)}
            className="input-field min-h-[38px] max-w-[200px] text-[13px]"
          />
        </div>
      </div>

      <section className="card-pro border border-indigo-200 bg-indigo-50/60 p-3 shadow-sm">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-indigo-950">
          Promedio de compra del día anterior
        </h3>
        <p className="mt-0.5 text-[10px] text-indigo-900/80">
          Respecto al día de estadísticas: se muestran las divisas con más volumen hoy y el{' '}
          <strong className="text-indigo-950">promedio ponderado de compra (COP/unidad)</strong> registrado en el cierre
          de <span className="font-mono">{addDaysYYYYMMDD(fechaDia, -1)}</span>.
        </p>
        {loading ? (
          <p className="mt-2 text-[11px]">…</p>
        ) : divisasMasMovimiento.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-600">Sin movimientos en el día seleccionado.</p>
        ) : (
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto pr-1">
            {divisasMasMovimiento.map((code) => {
              const row = cierresAyerPorMoneda.get(code)
              const prom = row != null ? Number(row.promedio_compra_dia) : null
              return (
                <li key={code} className="flex justify-between gap-2 font-mono text-[11px] tabular-nums">
                  <span className="font-semibold text-slate-800">{code}</span>
                  <span className="text-indigo-950">
                    {prom != null && Number.isFinite(prom) && prom > 0 ? formatMilesEs(prom, 2) + ' COP' : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">Compras (divisa)</h3>
          {loading ? <p className="mt-2 text-[11px]">…</p> : <ListaMontosDivisa items={comprasLista} />}
        </div>
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">Ventas (divisa)</h3>
          {loading ? <p className="mt-2 text-[11px]">…</p> : <ListaMontosDivisa items={ventasLista} />}
        </div>
      </section>

      <section className="card-pro border-2 border-emerald-600 bg-emerald-50/90 p-3 shadow-sm">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900">Ganancia (COP por divisa)</h3>
        {loading ? <p className="mt-2 text-[11px]">…</p> : <ListaGananciaDivisa items={gananciaLista} />}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">¿Quién me debe? (acumulado)</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Solo pendientes · montos en divisa.</p>
          {loading ? <p className="mt-2 text-[11px]">…</p> : <ListaMontosDivisa items={nosDebenLista} />}
        </div>
        <div className="card-pro border border-slate-200 p-3 shadow-sm">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-800">¿A quién le debo? (acumulado)</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">Solo pendientes · montos en divisa.</p>
          {loading ? <p className="mt-2 text-[11px]">…</p> : <ListaMontosDivisa items={debemosLista} />}
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
          <h3 className="text-[12px] font-semibold text-black">Operaciones del día seleccionado</h3>
          <p className="text-[10px] text-slate-600">Hasta {Math.min(10, recientes.length)} recientes.</p>
        </div>
        {loading ? (
          <p className="p-3 text-[12px] text-slate-700">Cargando…</p>
        ) : recientes.length === 0 ? (
          <p className="p-3 text-[12px] text-slate-700">Sin movimientos en esta fecha.</p>
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

      <section className="card-pro overflow-hidden border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <div>
            <h3 className="text-[12px] font-semibold text-black">Auditoría de cierres diarios</h3>
            <p className="text-[10px] text-slate-600">
              Registros del cierre para la misma fecha del selector ({fechaDia}). Fuente:{' '}
              <span className="font-mono">cierres_diarios</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onExportCierres}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Exportar a Excel
          </button>
        </div>
        {loading ? (
          <p className="p-3 text-[12px] text-slate-700">Cargando…</p>
        ) : cierresRows.length === 0 ? (
          <p className="p-3 text-[12px] text-slate-700">
            No hay cierres guardados para esta fecha. Finalice el cierre en{' '}
            <a href="/caja" className="font-semibold text-blue-700 underline">
              Caja diaria
            </a>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Moneda</th>
                  <th className="table-header text-right">Inicial</th>
                  <th className="table-header text-right">Prom. compra</th>
                  <th className="table-header text-right">Prom. venta</th>
                  <th className="table-header text-right">Cierre est.</th>
                  <th className="table-header text-right">Cierre real</th>
                  <th className="table-header text-right">Dif. arqueo</th>
                  <th className="table-header text-right">Ganancia COP</th>
                </tr>
              </thead>
              <tbody>
                {cierresRows.map((r) => {
                  const dif = Number(r.diferencia_arqueo)
                  const difBad = Number.isFinite(dif) && Math.abs(dif) > 1e-6
                  return (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="table-cell font-mono text-slate-800">{r.fecha}</td>
                      <td className="table-cell font-semibold">{r.moneda}</td>
                      <td className="table-cell text-right font-mono">{formatMilesEs(Number(r.monto_inicial), 2)}</td>
                      <td className="table-cell text-right font-mono">{formatMilesEs(Number(r.promedio_compra_dia), 2)}</td>
                      <td className="table-cell text-right font-mono">{formatMilesEs(Number(r.promedio_venta_dia), 2)}</td>
                      <td className="table-cell text-right font-mono">
                        {formatMilesEs(Number(r.cierre_estimado_sistema), 2)}
                      </td>
                      <td className="table-cell text-right font-mono font-semibold">
                        {formatMilesEs(Number(r.cierre_manual_fisico), 2)}
                      </td>
                      <td
                        className={`table-cell text-right font-mono font-semibold tabular-nums ${
                          difBad ? 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-400' : 'text-slate-600'
                        }`}
                      >
                        {formatMilesEs(dif, 2)}
                      </td>
                      <td className="table-cell text-right font-mono text-emerald-900">
                        {formatMilesEs(Number(r.ganancia_neta_cop), 0)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-slate-500">
        Caja: <a href="/caja" className="font-semibold text-blue-700 underline">Caja diaria</a> ·{' '}
        <a href="/historial" className="font-semibold text-blue-700 underline">Historial</a>.
      </p>
    </main>
  )
}
