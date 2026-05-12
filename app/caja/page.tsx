'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { finalizarCierreCaja } from '@/app/actions/caja'
import { dayBoundsLocal, formatMilesEs } from '@/lib/utils'
import { useFechaOperativa } from '@/components/fecha-operativa/FechaOperativaProvider'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { errorMessage } from '@/lib/errorMessage'
import type { Transaccion } from '@/types/database'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'
import { upsertCajaPrecios } from '@/app/actions/cajaPrecios'

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

function sumTxByMoneda(rows: Transaccion[], tipo: 'COMPRA' | 'VENTA'): Record<string, number> {
  const m: Record<string, number> = {}
  for (const r of rows) {
    if (r.tipo !== tipo) continue
    const k = r.moneda
    m[k] = (m[k] ?? 0) + Number(r.monto_divisa)
  }
  return m
}

const cellInput =
  'mx-auto w-full max-w-[140px] border-0 border-b-2 border-slate-300 bg-slate-50/90 py-2 px-2 text-center font-mono text-[13px] shadow-inner focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-0'

export default function CajaPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { fecha, esHistorico } = useFechaOperativa()
  const { rows: divisasRows } = useDivisasMaestro()
  const divisas = useMemo(() => (divisasRows.length ? divisasRows : DIVISAS_FALLBACK), [divisasRows])
  const [cierreMap, setCierreMap] = useState<Record<string, number>>({})
  const [montosManualCierre, setMontosManualCierre] = useState<Record<string, string>>({})
  const [preciosCompra, setPreciosCompra] = useState<Record<string, string>>({})
  const [editPrecios, setEditPrecios] = useState(false)
  const [guardandoPrecios, setGuardandoPrecios] = useState(false)
  const [comprasDia, setComprasDia] = useState<Record<string, number>>({})
  const [ventasDia, setVentasDia] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [cierreAyerPorMoneda, setCierreAyerPorMoneda] = useState<Record<string, number>>({})
  const [precioAyerUsdEur, setPrecioAyerUsdEur] = useState<Record<string, number>>({})

  const cargar = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setCierreMap({})
      setComprasDia({})
      setVentasDia({})
      setLoading(false)
      return
    }

    const { desde, hastaExclusive } = dayBoundsLocal(fecha)
    const [cajaRes, txRes, cierresPrevRes, preciosRes] = await Promise.all([
      supabase.from('caja_diaria').select('tipo,moneda,monto').eq('usuario_id', user.id).eq('fecha', fecha),
      supabase
        .from('transacciones')
        .select('*')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase
        .from('cierres_diarios')
        .select('moneda,cierre_manual,fecha,promedio_compra,promedio_compra_acumulado,id,created_at')
        .eq('usuario_id', user.id)
        .lt('fecha', fecha),
      // Para monedas “estables”: traer el último precio <= fecha (copiar hacia adelante).
      supabase
        .from('caja_precios')
        .select('moneda,precio_compra,fecha,ultima_modificacion')
        .eq('usuario_id', user.id)
        .lte('fecha', fecha)
        .order('fecha', { ascending: false })
        .order('ultima_modificacion', { ascending: false }),
    ])

    const ci: Record<string, number> = {}
    for (const r of cajaRes.data ?? []) {
      const row = r as { tipo: string; moneda: string; monto: number }
      if (row.tipo === 'CIERRE') ci[row.moneda] = Number(row.monto)
    }
    setCierreMap(ci)

    const txs = (txRes.data ?? []) as Transaccion[]
    setComprasDia(sumTxByMoneda(txs, 'COMPRA'))
    setVentasDia(sumTxByMoneda(txs, 'VENTA'))

    const ayer: Record<string, number> = {}
    const preciosAyer: Record<string, number> = {}
    if (!cierresPrevRes.error) {
      const fold = saldoPromedioPorMonedaDesdeCierres((cierresPrevRes.data ?? []) as CierreRowParaArrastre[])
      for (const [mon, v] of Array.from(fold.entries())) {
        ayer[mon] = v.saldoAnterior
        // usar el costo promedio anterior como "precio compra" por defecto (igual que Dashboard)
        preciosAyer[mon] = Number(v.promedioAnterior ?? 0)
      }

    }
    setCierreAyerPorMoneda(ayer)
    setPrecioAyerUsdEur(preciosAyer)

    const nextPrecios: Record<string, string> = {}
    const preciosRows = (preciosRes.error ? [] : preciosRes.data ?? []) as {
      moneda: string
      precio_compra: number
      fecha: string
    }[]
    const pm = new Map<string, number>()
    for (const r of preciosRows) {
      const mon = String(r.moneda).toUpperCase()
      // Como viene ordenado DESC, el primer match por moneda es el último precio vigente.
      if (!pm.has(mon)) pm.set(mon, Number(r.precio_compra))
    }
    for (const d of divisas) {
      const mon = d.codigo
      const saved = pm.get(mon)
      const fallbackBase = (preciosAyer.USD ?? 0) > 0 ? Number(preciosAyer.USD) : (preciosAyer.EUR ?? 0) > 0 ? Number(preciosAyer.EUR) : 0
      const fallback = (preciosAyer[mon] ?? 0) > 0 ? Number(preciosAyer[mon]) : fallbackBase
      const v = saved != null && Number.isFinite(saved) && saved > 0 ? saved : fallback
      nextPrecios[mon] = v > 0 ? formatMilesEs(v, 4) : ''
    }
    setPreciosCompra(nextPrecios)

    setLoading(false)
  }, [supabase, fecha, divisas])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user?.id) return

      channel = supabase
        .channel('caja-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transacciones', filter: `usuario_id=eq.${user.id}` },
          () => void cargar()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'caja_diaria', filter: `usuario_id=eq.${user.id}` },
          () => void cargar()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'caja_precios', filter: `usuario_id=eq.${user.id}` },
          () => void cargar()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cierres_diarios', filter: `usuario_id=eq.${user.id}` },
          () => void cargar()
        )
        .subscribe()
    })()

    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, cargar])

  useEffect(() => {
    const nextM: Record<string, string> = {}
    for (const d of divisas) {
      const m = cierreMap[d.codigo]
      nextM[d.codigo] = m != null && Number.isFinite(m) && m !== 0 ? formatMilesEs(m, 2) : ''
    }
    setMontosManualCierre(nextM)
  }, [cierreMap, divisas])

  const codigos = useMemo(() => {
    const s = new Set<string>()
    for (const d of divisas) s.add(d.codigo)
    for (const k of Object.keys(comprasDia)) s.add(k)
    for (const k of Object.keys(ventasDia)) s.add(k)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [divisas, comprasDia, ventasDia])

  const filas = useMemo(() => {
    return codigos.map((codigo) => {
      const ap = cierreAyerPorMoneda[codigo] ?? 0
      const comp = comprasDia[codigo] ?? 0
      const vent = ventasDia[codigo] ?? 0
      const estimado = ap + comp - vent
      const manualStr = montosManualCierre[codigo] ?? ''
      const manualNum = parseFlexibleNumber(manualStr)
      const manualOk = manualStr.trim() !== '' && Number.isFinite(manualNum)
      const diff = manualOk ? manualNum - estimado : null
      return { codigo, estimado, manualStr, diff }
    })
  }, [codigos, cierreAyerPorMoneda, comprasDia, ventasDia, montosManualCierre])

  const onFinalizarCierre = async () => {
    setFinalizando(true)
    try {
      const manualCierre: Record<string, number> = {}
      for (const row of filas) {
        const rawM = montosManualCierre[row.codigo] ?? ''
        const nM = parseFlexibleNumber(rawM)
        if (rawM.trim() !== '' && Number.isFinite(nM)) manualCierre[row.codigo] = nM
      }
      const res = await finalizarCierreCaja({ fecha, manualCierre })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(Object.keys(manualCierre).length > 0 ? 'Cierre guardado' : 'Actualizado')
      await cargar()
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setFinalizando(false)
    }
  }

  const onGuardarPrecios = async () => {
    setGuardandoPrecios(true)
    try {
      const out: Record<string, number> = {}
      for (const d of divisas) {
        const raw = preciosCompra[d.codigo] ?? ''
        const n = parseFlexibleNumber(raw)
        if (raw.trim() !== '' && Number.isFinite(n) && n >= 0) out[d.codigo] = n
      }
      const res = await upsertCajaPrecios({ fecha, precios: out })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Precios guardados')
      setEditPrecios(false)
      await cargar()
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setGuardandoPrecios(false)
    }
  }

  const totalCajaCop = useMemo(() => {
    let s = 0
    for (const f of filas) {
      const mStr = montosManualCierre[f.codigo] ?? ''
      const pcStr = preciosCompra[f.codigo] ?? ''
      const m = parseFlexibleNumber(mStr)
      const pc = parseFlexibleNumber(pcStr)
      if (mStr.trim() === '' || pcStr.trim() === '') continue
      if (!Number.isFinite(m) || !Number.isFinite(pc)) continue
      s += m * pc
    }
    return s
  }, [filas, montosManualCierre, preciosCompra])

  return (
    <div className="mx-auto max-w-4xl space-y-4 text-base text-black">
      {esHistorico ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Editando fecha pasada: <span className="font-mono font-semibold">{fecha}</span>
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 border-l-[4px] border-l-slate-800 bg-white shadow-md">
        {loading ? (
          <p className="p-6 text-center text-base text-slate-500">…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 px-3 py-2">
              <button
                type="button"
                onClick={() => setEditPrecios((v) => !v)}
                className="btn-secondary min-h-[44px] text-sm"
              >
                {editPrecios ? 'Bloquear precios' : 'Editar precios'}
              </button>
              {editPrecios ? (
                <button
                  type="button"
                  disabled={guardandoPrecios}
                  onClick={() => void onGuardarPrecios()}
                  className="btn-primary min-h-[44px] text-sm"
                >
                  {guardandoPrecios ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar precios'}
                </button>
              ) : null}
            </div>
            <table className="w-full border-collapse text-center text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="border-r border-slate-200 px-2 py-2 text-left font-bold text-slate-800">Moneda</th>
                  <th className="border-r border-slate-200 px-2 py-2 font-bold text-slate-800">Debo tener</th>
                  <th className="border-r border-slate-200 px-2 py-2 font-bold text-slate-800">Cierre manual</th>
                  <th className="border-r border-slate-200 px-2 py-2 font-bold text-slate-800">Precio compra</th>
                  <th className="px-2 py-2 font-bold text-slate-800">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const diffClass =
                    f.diff == null
                      ? 'text-slate-500'
                      : f.diff >= 0
                        ? 'text-blue-700'
                        : 'text-red-700'
                  return (
                    <tr key={f.codigo} className="border-b border-slate-100">
                      <td className="border-r border-slate-100 px-2 py-2 text-left align-middle">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          <span className="text-base leading-none" aria-hidden>
                            {FLAGS[f.codigo] ?? '💱'}
                          </span>
                          <span>
                            {divisas.find((d) => d.codigo === f.codigo)?.nombre_completo ?? f.codigo}{' '}
                            <span className="font-mono text-slate-600">({f.codigo})</span>
                          </span>
                        </span>
                      </td>
                      <td className="border-r border-slate-100 px-2 py-2 align-middle font-mono font-semibold tabular-nums">
                        {formatMilesEs(f.estimado, 4)}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 align-middle">
                        <MoneyTextField
                          id={`cm-${f.codigo}`}
                          label={`Cierre manual ${f.codigo}`}
                          omitLabel
                          maxFrac={2}
                          value={f.manualStr}
                          onChange={(v) => setMontosManualCierre((prev) => ({ ...prev, [f.codigo]: v }))}
                          className="flex justify-center"
                          inputClassName={cellInput}
                        />
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 align-middle">
                        <MoneyTextField
                          id={`pc-${f.codigo}`}
                          label={`Precio compra ${f.codigo}`}
                          omitLabel
                          maxFrac={4}
                          disabled={!editPrecios}
                          value={preciosCompra[f.codigo] ?? ''}
                          onChange={(v) => setPreciosCompra((prev) => ({ ...prev, [f.codigo]: v }))}
                          className="flex justify-center"
                          inputClassName={cellInput}
                        />
                      </td>
                      <td className={`px-2 py-2 align-middle font-mono font-bold tabular-nums ${diffClass}`}>
                        {f.diff != null ? formatMilesEs(f.diff, 4) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-200 bg-slate-50/90 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total caja (COP)</p>
              <p className="truncate font-mono text-lg font-bold tabular-nums text-slate-900">{formatMilesEs(totalCajaCop, 2)}</p>
            </div>
            <div className="flex justify-center border-t border-slate-200 px-3 py-4">
              <button
                type="button"
                disabled={finalizando}
                onClick={() => void onFinalizarCierre()}
                className="min-h-[52px] min-w-[220px] rounded-xl bg-gradient-to-b from-slate-800 to-slate-950 px-8 text-base font-bold text-white shadow-lg hover:from-slate-700 hover:to-slate-900 disabled:opacity-50"
              >
                {finalizando ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Actualizar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
