'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { guardarCajaDiaria, finalizarCierreCaja } from '@/app/actions/caja'
import { dayBoundsLocal, formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { errorMessage } from '@/lib/errorMessage'
import type { Transaccion } from '@/types/database'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'

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
  const { rows: divisasRows } = useDivisasMaestro()
  const divisas = useMemo(() => (divisasRows.length ? divisasRows : DIVISAS_FALLBACK), [divisasRows])

  const [fecha, setFecha] = useState(() => fechaLocalYYYYMMDD())
  const [aperturaMap, setAperturaMap] = useState<Record<string, number>>({})
  const [cierreMap, setCierreMap] = useState<Record<string, number>>({})
  const [montosApertura, setMontosApertura] = useState<Record<string, string>>({})
  const [montosManualCierre, setMontosManualCierre] = useState<Record<string, string>>({})
  const [comprasDia, setComprasDia] = useState<Record<string, number>>({})
  const [ventasDia, setVentasDia] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const [cierreAyerPorMoneda, setCierreAyerPorMoneda] = useState<Record<string, number>>({})
  const saveApTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistAperturaDebounced = useCallback(
    (snapshot: Record<string, string>) => {
      if (saveApTimer.current) clearTimeout(saveApTimer.current)
      saveApTimer.current = setTimeout(() => {
        saveApTimer.current = null
        void (async () => {
          const out: Record<string, number> = {}
          for (const d of divisas) {
            const raw = snapshot[d.codigo] ?? ''
            const n = parseFlexibleNumber(raw)
            if (raw.trim() !== '' && Number.isFinite(n)) out[d.codigo] = n
          }
          const res = await guardarCajaDiaria({ fecha, tipo: 'APERTURA', montos: out })
          if (!res.ok) toast.error(res.error)
        })()
      }, 700)
    },
    [fecha, divisas]
  )

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
      setLoading(false)
      return
    }

    const { desde, hastaExclusive } = dayBoundsLocal(fecha)
    const [cajaRes, txRes, cierresPrevRes] = await Promise.all([
      supabase.from('caja_diaria').select('tipo,moneda,monto').eq('usuario_id', user.id).eq('fecha', fecha),
      supabase
        .from('transacciones')
        .select('*')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase
        .from('cierres_diarios')
        .select('moneda,cierre_manual,fecha,promedio_compra,promedio_compra_acumulado')
        .eq('usuario_id', user.id)
        .lt('fecha', fecha),
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

    const ayer: Record<string, number> = {}
    if (!cierresPrevRes.error) {
      const fold = saldoPromedioPorMonedaDesdeCierres((cierresPrevRes.data ?? []) as CierreRowParaArrastre[])
      for (const [mon, v] of Array.from(fold.entries())) ayer[mon] = v.saldoAnterior
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

  const codigos = useMemo(() => {
    const s = new Set<string>()
    for (const d of divisas) s.add(d.codigo)
    for (const k of Object.keys(aperturaMap)) s.add(k)
    for (const k of Object.keys(comprasDia)) s.add(k)
    for (const k of Object.keys(ventasDia)) s.add(k)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [divisas, aperturaMap, comprasDia, ventasDia])

  const filas = useMemo(() => {
    return codigos.map((codigo) => {
      const rawAp = montosApertura[codigo] ?? ''
      const parsedAp = parseFlexibleNumber(rawAp)
      const ap = rawAp.trim() !== '' && Number.isFinite(parsedAp) ? parsedAp : (aperturaMap[codigo] ?? 0)
      const comp = comprasDia[codigo] ?? 0
      const vent = ventasDia[codigo] ?? 0
      const estimado = ap + comp - vent
      const manualStr = montosManualCierre[codigo] ?? ''
      const manualNum = parseFlexibleNumber(manualStr)
      const manualOk = manualStr.trim() !== '' && Number.isFinite(manualNum)
      const diff = manualOk ? manualNum - estimado : null
      return { codigo, estimado, manualStr, diff }
    })
  }, [codigos, montosApertura, aperturaMap, comprasDia, ventasDia, montosManualCierre])

  const onFinalizarCierre = async () => {
    setFinalizando(true)
    try {
      const manualCierre: Record<string, number> = {}
      for (const row of filas) {
        const rawM = montosManualCierre[row.codigo] ?? ''
        const nM = parseFlexibleNumber(rawM)
        if (rawM.trim() !== '' && Number.isFinite(nM)) manualCierre[row.codigo] = nM
      }
      const aperturas: Record<string, number> = {}
      for (const codigo of Object.keys(manualCierre)) {
        const rawA = montosApertura[codigo] ?? ''
        const nA = parseFlexibleNumber(rawA)
        if (rawA.trim() !== '' && Number.isFinite(nA)) aperturas[codigo] = nA
        else aperturas[codigo] = aperturaMap[codigo] ?? 0
      }
      const res = await finalizarCierreCaja({ fecha, manualCierre, aperturas })
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

  return (
    <div className="mx-auto max-w-4xl space-y-4 text-base text-black">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="input-field min-h-[48px] max-w-[200px] text-base"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 border-l-[4px] border-l-slate-800 bg-white shadow-md">
        {loading ? (
          <p className="p-6 text-center text-base text-slate-500">…</p>
        ) : (
          <>
            <table className="w-full border-collapse text-center text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="border-r border-slate-200 px-2 py-2 text-left font-bold text-slate-800">Moneda</th>
                  <th className="border-r border-slate-200 px-2 py-2 font-bold text-slate-800">Apertura</th>
                  <th className="border-r border-slate-200 px-2 py-2 font-bold text-slate-800">Cierre est.</th>
                  <th className="border-r border-slate-200 px-2 py-2 font-bold text-slate-800">Cierre manual</th>
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
                      <td className="border-r border-slate-100 px-2 py-1.5 align-middle">
                        <MoneyTextField
                          id={`ap-${f.codigo}`}
                          label={`Apertura ${f.codigo}`}
                          omitLabel
                          maxFrac={2}
                          value={montosApertura[f.codigo] ?? ''}
                          onChange={(v) => {
                            setMontosApertura((prev) => {
                              const next = { ...prev, [f.codigo]: v }
                              persistAperturaDebounced(next)
                              return next
                            })
                          }}
                          className="flex justify-center"
                          inputClassName={cellInput}
                        />
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
                      <td className={`px-2 py-2 align-middle font-mono font-bold tabular-nums ${diffClass}`}>
                        {f.diff != null ? formatMilesEs(f.diff, 4) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
