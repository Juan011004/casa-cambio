'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { guardarCajaDiaria, finalizarCierreCaja } from '@/app/actions/caja'
import { addDaysYYYYMMDD, dayBoundsLocal, formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { errorMessage } from '@/lib/errorMessage'
import type { Transaccion } from '@/types/database'

function sumTxByMoneda(rows: Transaccion[], tipo: 'COMPRA' | 'VENTA'): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) {
    if (r.tipo !== tipo) continue
    const k = r.moneda
    m[k] = (m[k] ?? 0) + Number(r.monto_divisa)
  }
  return m
}

function sumDeudaRows(rows: { tipo: string; divisa: string; monto: number }[], tipo: 'DEBEN' | 'DEBO'): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) {
    if (r.tipo !== tipo) continue
    if (r.divisa === 'COP') continue
    m[r.divisa] = (m[r.divisa] ?? 0) + Number(r.monto)
  }
  return m
}

export default function CajaPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { rows: divisasRows } = useDivisasMaestro()
  const divisas = useMemo(() => (divisasRows.length ? divisasRows : DIVISAS_FALLBACK), [divisasRows])

  const [fecha, setFecha] = useState(() => fechaLocalYYYYMMDD())
  const [aperturaMap, setAperturaMap] = useState<Record<string, number>>({})
  const [cierreMap, setCierreMap] = useState<Record<string, number>>({})
  const [montosApertura, setMontosApertura] = useState<Record<string, string>>({})
  const [montosManualCierre, setMontosManualCierre] = useState<Record<string, string>>({})
  const [comprasDia, setComprasDia] = useState<Record<string, number>>({})
  const [ventasDia, setVentasDia] = useState<Record<string, number>>({})
  const [debenDia, setDebenDia] = useState<Record<string, number>>({})
  const [deboDia, setDeboDia] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [guardandoApertura, setGuardandoApertura] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [cierreAyerPorMoneda, setCierreAyerPorMoneda] = useState<Record<string, number>>({})

  const cargar = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setAperturaMap({})
      setCierreMap({})
      setComprasDia({})
      setVentasDia({})
      setDebenDia({})
      setDeboDia({})
      setLoading(false)
      return
    }

    const { desde, hastaExclusive } = dayBoundsLocal(fecha)
    const fechaAyer = addDaysYYYYMMDD(fecha, -1)

    const [cajaRes, txRes, deudaRes, cierresAyerRes] = await Promise.all([
      supabase.from('caja_diaria').select('tipo,moneda,monto').eq('usuario_id', user.id).eq('fecha', fecha),
      supabase
        .from('transacciones')
        .select('*')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase
        .from('deudas')
        .select('tipo,divisa,monto')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase
        .from('cierres_diarios')
        .select('moneda,cierre_manual_fisico')
        .eq('usuario_id', user.id)
        .eq('fecha', fechaAyer),
    ])

    const ap: Record<string, number> = {}
    const ci: Record<string, number> = {}
    for (const r of cajaRes.data ?? []) {
      const row = r as { tipo: string; moneda: string; monto: number }
      if (row.tipo === 'APERTURA') ap[row.moneda] = Number(row.monto)
      if (row.tipo === 'CIERRE') ci[row.moneda] = Number(row.monto)
    }
    setAperturaMap(ap)
    setCierreMap(ci)

    const txs = (txRes.data ?? []) as Transaccion[]
    setComprasDia(sumTxByMoneda(txs, 'COMPRA'))
    setVentasDia(sumTxByMoneda(txs, 'VENTA'))

    const debtRows = (deudaRes.data ?? []) as { tipo: string; divisa: string; monto: number }[]
    setDebenDia(sumDeudaRows(debtRows, 'DEBEN'))
    setDeboDia(sumDeudaRows(debtRows, 'DEBO'))

    const ayer: Record<string, number> = {}
    if (!cierresAyerRes.error) {
      for (const r of cierresAyerRes.data ?? []) {
        const row = r as { moneda: string; cierre_manual_fisico: number }
        ayer[row.moneda] = Number(row.cierre_manual_fisico)
      }
    }
    setCierreAyerPorMoneda(ayer)

    setLoading(false)
  }, [supabase, fecha])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const nextA: Record<string, string> = {}
    for (const d of divisas) {
      const m = aperturaMap[d.codigo]
      if (m != null && Number.isFinite(m)) {
        nextA[d.codigo] = m !== 0 ? formatMilesEs(m, 2) : ''
      } else {
        const y = cierreAyerPorMoneda[d.codigo]
        nextA[d.codigo] = y != null && Number.isFinite(y) && y !== 0 ? formatMilesEs(y, 2) : ''
      }
    }
    setMontosApertura(nextA)
  }, [aperturaMap, cierreAyerPorMoneda, divisas])

  useEffect(() => {
    const nextM: Record<string, string> = {}
    for (const d of divisas) {
      const m = cierreMap[d.codigo]
      nextM[d.codigo] = m != null && Number.isFinite(m) && m !== 0 ? formatMilesEs(m, 2) : ''
    }
    setMontosManualCierre(nextM)
  }, [cierreMap, divisas])

  const codigosCierre = useMemo(() => {
    const s = new Set<string>()
    for (const d of divisas) s.add(d.codigo)
    for (const k of Object.keys(aperturaMap)) s.add(k)
    for (const k of Object.keys(comprasDia)) s.add(k)
    for (const k of Object.keys(ventasDia)) s.add(k)
    for (const k of Object.keys(debenDia)) s.add(k)
    for (const k of Object.keys(deboDia)) s.add(k)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [divisas, aperturaMap, comprasDia, ventasDia, debenDia, deboDia])

  const filasCierre = useMemo(() => {
    return codigosCierre.map((codigo) => {
      const ap = aperturaMap[codigo] ?? 0
      const comp = comprasDia[codigo] ?? 0
      const vent = ventasDia[codigo] ?? 0
      const db = debenDia[codigo] ?? 0
      const dbo = deboDia[codigo] ?? 0
      const estimado = ap + comp - vent - db + dbo
      const manualStr = montosManualCierre[codigo] ?? ''
      const manualNum = parseFlexibleNumber(manualStr)
      const manualOk = manualStr.trim() !== '' && Number.isFinite(manualNum)
      const diff = manualOk ? manualNum - estimado : null
      return { codigo, ap, comp, vent, db, dbo, estimado, manualStr, diff }
    })
  }, [codigosCierre, aperturaMap, comprasDia, ventasDia, debenDia, deboDia, montosManualCierre])

  const guardarApertura = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardandoApertura(true)
    try {
      const out: Record<string, number> = {}
      for (const d of divisas) {
        const raw = montosApertura[d.codigo] ?? ''
        const n = parseFlexibleNumber(raw)
        if (raw.trim() !== '' && Number.isFinite(n)) out[d.codigo] = n
      }
      const res = await guardarCajaDiaria({ fecha, tipo: 'APERTURA', montos: out })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Apertura guardada')
      await cargar()
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setGuardandoApertura(false)
    }
  }

  const onFinalizarCierre = async () => {
    setFinalizando(true)
    try {
      const manualCierre: Record<string, number> = {}
      for (const row of filasCierre) {
        const raw = montosManualCierre[row.codigo] ?? ''
        const n = parseFlexibleNumber(raw)
        if (raw.trim() !== '' && Number.isFinite(n)) manualCierre[row.codigo] = n
      }
      if (Object.keys(manualCierre).length === 0) {
        toast.error('Indique al menos un cierre manual contado.')
        return
      }
      const res = await finalizarCierreCaja({ fecha, manualCierre })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Cierre finalizado e inventario actualizado')
      await cargar()
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 text-[13px] text-black">
      <h1 className="text-base font-semibold">Caja diaria</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-[11px]" htmlFor="fecha-caja">
            Fecha (día operativo)
          </label>
          <input
            id="fecha-caja"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="input-field min-h-[40px] max-w-[200px]"
          />
        </div>
      </div>

      <section className="card-pro space-y-3 border border-slate-200 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-800">1. Apertura</h2>
        <p className="text-[11px] text-slate-600">
          Montos físicos al inicio del día. Si no hay apertura guardada, se sugiere el{' '}
          <strong className="text-black">cierre físico del día anterior</strong> (auditoría). Guarde antes de operar.
        </p>
        {loading ? (
          <p className="text-sm text-slate-600">Cargando…</p>
        ) : (
          <form onSubmit={guardarApertura} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {divisas.map((d) => (
                <MoneyTextField
                  key={`ap-${d.codigo}`}
                  id={`ap-${d.codigo}`}
                  label={`${d.codigo} — ${d.nombre_completo}`}
                  maxFrac={2}
                  value={montosApertura[d.codigo] ?? ''}
                  onChange={(v) => setMontosApertura((prev) => ({ ...prev, [d.codigo]: v }))}
                  inputClassName="input-field input-numeric min-h-[44px] py-2 text-sm"
                />
              ))}
            </div>
            <button type="submit" disabled={guardandoApertura} className="btn-primary min-h-[42px] w-full text-sm sm:w-auto">
              {guardandoApertura ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar apertura'}
            </button>
          </form>
        )}
      </section>

      <section className="card-pro overflow-hidden border border-slate-200">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-800">2. Cierre del día</h2>
          <p className="mt-1 text-[11px] text-slate-600">
            Cierre estimado = apertura + compras − ventas − «Nos deben» del día + «Debemos» del día (solo divisa
            extranjera en deudas). Solo el <strong className="text-black">cierre manual</strong> es editable.
          </p>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-slate-600">Cargando…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <th className="table-header">Moneda</th>
                    <th className="table-header text-right">Apertura</th>
                    <th className="table-header text-right">+ Compras</th>
                    <th className="table-header text-right">− Ventas</th>
                    <th className="table-header text-right">− Nos deben (día)</th>
                    <th className="table-header text-right">+ Debemos (día)</th>
                    <th className="table-header text-right">Cierre est.</th>
                    <th className="table-header text-left min-w-[120px]">Cierre manual</th>
                    <th className="table-header text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {filasCierre.map((f) => {
                    const manualStr = montosManualCierre[f.codigo] ?? ''
                    const showDiff = f.diff != null && Math.abs(f.diff) > 1e-6
                    return (
                      <tr key={f.codigo} className="border-b border-slate-100">
                        <td className="table-cell font-semibold">{f.codigo}</td>
                        <td className="table-cell text-right font-mono">{formatMilesEs(f.ap, 2)}</td>
                        <td className="table-cell text-right font-mono text-emerald-800">{formatMilesEs(f.comp, 4)}</td>
                        <td className="table-cell text-right font-mono text-amber-900">{formatMilesEs(f.vent, 4)}</td>
                        <td className="table-cell text-right font-mono">{formatMilesEs(f.db, 4)}</td>
                        <td className="table-cell text-right font-mono">{formatMilesEs(f.dbo, 4)}</td>
                        <td className="table-cell text-right font-mono font-semibold">{formatMilesEs(f.estimado, 4)}</td>
                        <td className="table-cell py-1">
                          <MoneyTextField
                            id={`ci-${f.codigo}`}
                            label={`Cierre manual ${f.codigo}`}
                            omitLabel
                            maxFrac={2}
                            value={manualStr}
                            onChange={(v) => setMontosManualCierre((prev) => ({ ...prev, [f.codigo]: v }))}
                            className="min-w-[100px]"
                            inputClassName="input-field input-numeric min-h-[36px] py-1 text-[11px]"
                          />
                        </td>
                        <td
                          className={`table-cell text-right font-mono font-semibold tabular-nums ${
                            showDiff
                              ? 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {f.diff != null ? formatMilesEs(f.diff, 4) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                disabled={finalizando}
                onClick={() => void onFinalizarCierre()}
                className="btn-primary min-h-[42px] w-full text-sm sm:w-auto"
              >
                {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Finalizar cierre'}
              </button>
              <p className="mt-2 text-[10px] text-slate-500">
                Diferencia = cierre manual − cierre estimado. Si no es cero, se muestra en rojo.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
