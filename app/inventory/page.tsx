'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { RefreshCw, Wallet } from 'lucide-react'
import { formatMilesEs } from '@/lib/utils'
import { SkeletonTable } from '@/components/ui/Skeletons'
import type { InventarioItem } from '@/types/database'

export default function InventoryPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<InventarioItem[]>([])

  const cargar = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('inventario')
      .select('id,divisa,cantidad_actual,ultima_actualizacion')
      .eq('usuario_id', user.id)
      .order('divisa')
    setRows((data ?? []) as InventarioItem[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <main className="mx-auto max-w-2xl space-y-4 text-base text-black" aria-label="Inventario">
      <header className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => void cargar()}
          className="btn-secondary inline-flex items-center gap-2 text-base"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </header>

      {loading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          Sin movimientos registrados aún. Registra una compra o una deuda para ver saldos.
        </p>
      ) : (
        <div className="card-pro overflow-hidden border border-slate-200">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100">
                <th className="table-header">Divisa</th>
                <th className="table-header text-right">Cantidad actual</th>
                <th className="table-header text-left">Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id ?? r.divisa} className="border-b border-slate-100">
                  <td className="table-cell font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      {r.divisa}
                    </span>
                  </td>
                  <td className="table-cell text-right font-mono font-medium">
                    {formatMilesEs(Number(r.cantidad_actual), 4)}
                  </td>
                  <td className="table-cell text-base text-slate-600">
                    {r.ultima_actualizacion
                      ? new Date(r.ultima_actualizacion).toLocaleString('es-CO', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
