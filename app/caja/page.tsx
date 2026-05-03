'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { guardarCajaDiaria } from '@/app/actions/caja'
import { formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { errorMessage } from '@/lib/errorMessage'

type TipoCaja = 'APERTURA' | 'CIERRE'

export default function CajaPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { rows: divisasRows } = useDivisasMaestro()
  const divisas = useMemo(() => (divisasRows.length ? divisasRows : DIVISAS_FALLBACK), [divisasRows])

  const [modo, setModo] = useState<TipoCaja>('APERTURA')
  const [montos, setMontos] = useState<Record<string, string>>({})
  const [aperturaMap, setAperturaMap] = useState<Record<string, number>>({})
  const [cierreMap, setCierreMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const fecha = fechaLocalYYYYMMDD()

  const cargarMapas = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setAperturaMap({})
      setCierreMap({})
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('caja_diaria')
      .select('tipo,moneda,monto')
      .eq('usuario_id', user.id)
      .eq('fecha', fecha)

    const ap: Record<string, number> = {}
    const ci: Record<string, number> = {}
    for (const r of data ?? []) {
      const row = r as { tipo: string; moneda: string; monto: number }
      if (row.tipo === 'APERTURA') ap[row.moneda] = Number(row.monto)
      if (row.tipo === 'CIERRE') ci[row.moneda] = Number(row.monto)
    }
    setAperturaMap(ap)
    setCierreMap(ci)
    setLoading(false)
  }, [supabase, fecha])

  useEffect(() => {
    void cargarMapas()
  }, [cargarMapas])

  useEffect(() => {
    const modoMap = modo === 'APERTURA' ? aperturaMap : cierreMap
    const next: Record<string, string> = {}
    for (const d of divisas) {
      const m = modoMap[d.codigo]
      next[d.codigo] = m != null && Number.isFinite(m) && m !== 0 ? formatMilesEs(m, 2) : ''
    }
    setMontos(next)
  }, [modo, aperturaMap, cierreMap, divisas])

  const setMonto = (codigo: string, v: string) => {
    setMontos((prev) => ({ ...prev, [codigo]: v }))
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const out: Record<string, number> = {}
      for (const d of divisas) {
        const raw = montos[d.codigo] ?? ''
        const n = parseFlexibleNumber(raw)
        if (raw.trim() !== '' && Number.isFinite(n)) {
          out[d.codigo] = n
        }
      }
      const res = await guardarCajaDiaria({ fecha, tipo: modo, montos: out })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Caja guardada')
      await cargarMapas()
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setGuardando(false)
    }
  }

  const filasResumen = useMemo(() => {
    return divisas.map((d) => {
      const a = aperturaMap[d.codigo]
      const c = cierreMap[d.codigo]
      const aNum = a != null && Number.isFinite(a) ? a : null
      const cNum = c != null && Number.isFinite(c) ? c : null
      let diff: number | null = null
      if (aNum != null && cNum != null) diff = cNum - aNum
      return { codigo: d.codigo, a: aNum, c: cNum, diff }
    })
  }, [divisas, aperturaMap, cierreMap])

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-sm text-black">
      <h1 className="text-base font-semibold">Caja diaria</h1>
      <p className="text-xs text-slate-600">Fecha local: {fecha}</p>

      <div className="flex gap-2">
        {(['APERTURA', 'CIERRE'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setModo(t)}
            className={`min-h-[40px] flex-1 rounded-md border px-3 text-xs font-semibold ${
              modo === t ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-black hover:bg-slate-50'
            }`}
          >
            {t === 'APERTURA' ? 'Apertura' : 'Cierre'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-600">Cargando…</p>
      ) : (
        <form onSubmit={guardar} className="card-pro space-y-4 border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-800">
            Monto físico en caja — {modo === 'APERTURA' ? 'apertura' : 'cierre'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {divisas.map((d) => (
              <MoneyTextField
                key={`${modo}-${d.codigo}`}
                id={`m-${d.codigo}`}
                label={`${d.codigo} — ${d.nombre_completo}`}
                maxFrac={2}
                value={montos[d.codigo] ?? ''}
                onChange={(v) => setMonto(d.codigo, v)}
                inputClassName="input-field input-numeric min-h-[52px] py-3 text-base font-semibold"
              />
            ))}
          </div>
          <button type="submit" disabled={guardando} className="btn-primary min-h-[44px] w-full text-sm">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </button>
        </form>
      )}

      <section className="card-pro overflow-hidden border border-slate-200">
        <h2 className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-800">
          Resumen comparativo
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100">
                <th className="table-header">Moneda</th>
                <th className="table-header text-right">Apertura</th>
                <th className="table-header text-right">Cierre</th>
                <th className="table-header text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filasResumen.map((f) => (
                <tr key={f.codigo} className="border-b border-slate-100">
                  <td className="table-cell font-semibold">{f.codigo}</td>
                  <td className="table-cell text-right font-mono">{f.a != null ? formatMilesEs(f.a, 2) : '—'}</td>
                  <td className="table-cell text-right font-mono">{f.c != null ? formatMilesEs(f.c, 2) : '—'}</td>
                  <td
                    className={`table-cell text-right font-mono font-semibold ${
                      f.diff == null ? 'text-slate-500' : f.diff >= 0 ? 'text-blue-700' : 'text-red-700'
                    }`}
                  >
                    {f.diff != null ? formatMilesEs(f.diff, 2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-600">
          Diferencia = cierre − apertura. Azul: sobrante o igual. Rojo: faltante.
        </p>
      </section>
    </div>
  )
}
