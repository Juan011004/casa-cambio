'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCOP, dayBoundsLocal } from '@/lib/utils'
import { useFechaOperativa } from '@/components/fecha-operativa/FechaOperativaProvider'
import { eliminarGasto, registrarGasto } from '@/app/actions/gastos'
import { errorMessage } from '@/lib/errorMessage'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { parseFlexibleNumber } from '@/lib/parseMoney'

type GastoRow = {
  id: string
  concepto: string
  monto_cop: number
  fecha: string
}

export default function GastosPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { fecha: fechaOperativa, esHistorico } = useFechaOperativa()
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<GastoRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setListLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      setListLoading(false)
      return
    }
    const { desde, hastaExclusive } = dayBoundsLocal(fechaOperativa)

    const { data, error } = await supabase
      .from('gastos')
      .select('id,concepto,monto_cop,fecha')
      .eq('usuario_id', user.id)
      .gte('fecha', desde)
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })

    if (error) {
      toast.error('No se pudieron cargar los gastos', { description: error.message })
      setRows([])
    } else {
      setRows(
        (data ?? []).map((r) => ({
          id: String((r as Record<string, unknown>).id),
          concepto: String((r as Record<string, unknown>).concepto),
          monto_cop: Number((r as Record<string, unknown>).monto_cop),
          fecha: String((r as Record<string, unknown>).fecha),
        }))
      )
    }
    setListLoading(false)
  }, [supabase, fechaOperativa])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const totalGastosCop = useMemo(() => rows.reduce((s, r) => s + r.monto_cop, 0), [rows])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (esHistorico) {
      toast.error('Modo histórico: solo lectura. Cambie la fecha global a hoy para registrar gastos.')
      return
    }
    const m = parseFlexibleNumber(monto)
    if (!concepto.trim()) {
      toast.error('Escriba el concepto.')
      return
    }
    if (!Number.isFinite(m) || m <= 0) {
      toast.error('Indique un monto válido.')
      return
    }
    setLoading(true)
    try {
      const res = await registrarGasto({ concepto: concepto.trim(), monto_cop: m, fecha: fechaOperativa })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Gasto guardado')
      setConcepto('')
      setMonto('')
      await cargar()
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const borrar = async (id: string) => {
    if (esHistorico) return
    setDeletingId(id)
    try {
      const res = await eliminarGasto({ id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Eliminado')
      await cargar()
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 text-base text-black">
      {esHistorico ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          <span className="font-semibold">Solo lectura:</span> gastos registrados el{' '}
          <span className="font-mono font-semibold">{fechaOperativa}</span>. No se pueden añadir ni borrar desde aquí para
          no alterar el histórico guardado.
        </p>
      ) : null}
      <form
        onSubmit={guardar}
        noValidate
        className={`card-pro flex flex-col gap-3 border border-slate-200 p-4 sm:flex-row sm:flex-wrap sm:items-end ${esHistorico ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="g-concepto">
            Concepto
          </label>
          <input
            id="g-concepto"
            className="input-field min-h-[48px] text-base"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            autoComplete="off"
          />
        </div>
        <MoneyTextField
          id="g-monto"
          label="Monto COP"
          maxFrac={2}
          className="w-full sm:w-40"
          value={monto}
          onChange={setMonto}
        />
        <button
          type="submit"
          disabled={loading || esHistorico}
          className="btn-primary min-h-[48px] w-full shrink-0 px-6 text-base font-semibold sm:w-auto"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
        </button>
      </form>

      <section className="card-pro overflow-hidden border border-slate-200 border-l-[4px] border-l-amber-600">
        {listLoading ? (
          <p className="p-4 text-base text-slate-700">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-base text-slate-700">Sin gastos hoy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="table-header">Fecha</th>
                  <th className="table-header">Concepto</th>
                  <th className="table-header text-right">Monto</th>
                  <th className="table-header w-16 text-center"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="table-cell text-slate-800">
                      {new Date(r.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="table-cell font-medium">{r.concepto}</td>
                    <td className="table-cell text-right font-mono font-semibold">{formatCOP(r.monto_cop)}</td>
                    <td className="table-cell text-center">
                      <button
                        type="button"
                        title="Eliminar"
                        disabled={esHistorico || deletingId === r.id}
                        onClick={() => void borrar(r.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-700 bg-white text-red-800 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-700">
                    Total (COP)
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-lg font-bold tabular-nums text-slate-900">
                    {formatCOP(totalGastosCop)}
                  </td>
                  <td className="bg-slate-50" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
