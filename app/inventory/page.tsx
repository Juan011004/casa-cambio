'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { Layers, Save, Loader2, RefreshCw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { formatUSD } from '@/lib/utils'
import { SkeletonTable } from '@/components/ui/Skeletons'
import type { InventarioItem } from '@/types/database'
import { guardarInventarioBoveda } from '@/app/actions/inventory'
import { errorMessage } from '@/lib/errorMessage'

const DIVISAS = ['USD', 'EUR', 'GBP', 'BRL']
const DENOMINACIONES = [1, 5, 10, 20, 50, 100]

type InventarioMap = Record<string, Record<number, number>>

function buildMap(data: InventarioItem[]): InventarioMap {
  const map: InventarioMap = {}
  for (const d of DIVISAS) {
    map[d] = {}
    for (const den of DENOMINACIONES) {
      map[d][den] = 0
    }
  }
  for (const row of data) {
    const den = Number(row.denominacion)
    if (map[row.divisa]?.[den] != null) map[row.divisa][den] = Number(row.cantidad)
  }
  return map
}

function totalPorDivisa(map: InventarioMap, divisa: string): number {
  return DENOMINACIONES.reduce((sum, den) => sum + (map[divisa]?.[den] ?? 0) * den, 0)
}

export default function InventoryPage() {
  const supabase = createBrowserSupabaseClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [map, setMap] = useState<InventarioMap>({})

  const fetchInventory = async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    let q = supabase.from('inventario').select('*').order('divisa').order('denominacion')
    if (user?.id) q = q.eq('usuario_id', user.id)
    const { data } = await q

    const rows = (data ?? []) as InventarioItem[]
    setMap(buildMap(rows))
    setLoading(false)
  }

  useEffect(() => {
    fetchInventory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (divisa: string, denom: number, value: string) => {
    const num = parseInt(value, 10)
    setMap((prev) => ({
      ...prev,
      [divisa]: {
        ...prev[divisa],
        [denom]: isNaN(num) ? 0 : num,
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const upsertRows: {
        id?: string
        divisa: string
        denominacion: number
        cantidad: number
        updated_at?: string
      }[] = []
      for (const divisa of DIVISAS) {
        for (const den of DENOMINACIONES) {
          const cantidad = map[divisa]?.[den] ?? 0
          upsertRows.push({ divisa, denominacion: den, cantidad })
        }
      }

      const res = await guardarInventarioBoveda(upsertRows)
      if (!res.ok) {
        toast.error('No se pudo guardar la bóveda', { description: res.error })
        return
      }
      toast.success('Bóveda actualizada')
      fetchInventory()
    } catch (e: unknown) {
      toast.error('Error al guardar', { description: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <main className="space-y-8" aria-label="Panel de bóveda">
        <header className="mb-2">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-800" />
        </header>
        <SkeletonTable rows={6} cols={8} />
      </main>
    )

  return (
    <main className="space-y-8" aria-label="Panel de bóveda">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Bóveda · Denominaciones
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Control por fajos: unidades × denominación = subtotal cara.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={fetchInventory}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Guardando…' : 'Guardar bóveda'}
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Totales por divisa">
        {DIVISAS.map((d) => (
          <motion.div
            key={d}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-pro flex items-center justify-between gap-3 p-4"
          >
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Total {d}</span>
            </div>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
              {formatUSD(totalPorDivisa(map, d))} {d}
            </span>
          </motion.div>
        ))}
      </section>

      <section className="space-y-10" aria-label="Desglose por divisa">
        {DIVISAS.map((divisa) => (
          <article key={divisa} className="card-pro overflow-hidden">
            <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/70">
              <Layers className="h-5 w-5 text-slate-500 dark:text-slate-400" aria-hidden />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{divisa}</h2>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400/90">
                  {formatUSD(totalPorDivisa(map, divisa))} cara
                </p>
              </div>
            </header>

            <div className="grid gap-4 p-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {DENOMINACIONES.map((den) => {
                const units = map[divisa]?.[den] ?? 0
                const sub = units * den
                return (
                  <motion.div
                    key={`${divisa}-${den}`}
                    whileHover={{ y: -3 }}
                    className={`rounded-xl border p-4 shadow-inner shadow-black/30 ${
                      units > 0
                        ? 'border-emerald-500/35 bg-emerald-500/[0.07]'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-slate-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-300">
                        Billete x{den}
                      </span>
                    </div>
                    <div
                      title="Apilamiento ilustrativo (máximo 14 capas)."
                      className="mt-3 flex min-h-[56px] flex-col-reverse gap-0.5"
                      aria-hidden
                    >
                      {Array.from({
                        length: Math.min(Math.max(units > 10 ? Math.ceil(Math.sqrt(units)) : units, units > 0 ? 3 : 0), 14),
                      }).map((_, i) => (
                        <div
                          key={i}
                          className="mx-auto h-1.5 max-w-[80%] rounded-sm bg-emerald-500/40 shadow-sm ring-1 ring-emerald-400/40"
                          style={{ width: `${100 - Math.min(i, 12) * 4}%`, opacity: 0.95 - i * 0.035 }}
                        />
                      ))}
                    </div>
                    <label className="mt-4 block">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Unidades
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={units}
                        onChange={(e) => handleChange(divisa, den, e.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-center font-mono text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                    <p className="mt-3 text-[11px] text-slate-500">
                      Subtotal <span className="font-mono font-semibold text-slate-200">{formatUSD(sub)}</span>
                    </p>
                  </motion.div>
                )
              })}
            </div>

            {/* Tabla técnica (densidad alta) */}
            <div className="border-t border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto px-6 py-6">
                <table className="min-w-[700px] w-full border-collapse text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/65">
                    <tr>
                      <th className="table-header sticky left-0 z-10 bg-slate-900/90 backdrop-blur">Denominación</th>
                      {DENOMINACIONES.map((d) => (
                        <th key={d} className="table-header text-center font-mono text-xs font-bold normal-case tracking-normal">
                          {divisa}&nbsp;{d}
                        </th>
                      ))}
                      <th className="table-header text-right">Subtotal cara</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="transition hover:bg-slate-800/35">
                      <td className="table-cell sticky left-0 z-10 bg-inherit font-semibold text-slate-500">Unidades</td>
                      {DENOMINACIONES.map((denom) => (
                        <td key={denom} className="table-cell text-center">
                          <span className="font-mono text-slate-900 dark:text-slate-100">
                            {map[divisa]?.[denom] ?? 0}
                          </span>
                        </td>
                      ))}
                      <td className="table-cell text-right font-mono font-bold text-emerald-300">
                        {formatUSD(totalPorDivisa(map, divisa))}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/55">
                      <td className="table-cell sticky left-0 z-10 bg-inherit font-semibold text-slate-500">
                        Subtotal denominación (cara)
                      </td>
                      {DENOMINACIONES.map((denom) => (
                        <td key={denom} className="table-cell text-center font-mono text-xs text-slate-400">
                          {formatUSD((map[divisa]?.[denom] ?? 0) * denom)}
                        </td>
                      ))}
                      <td className="table-cell" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
