'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { Loader2, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { registrarDeuda, editarDeudaMonto, eliminarDeuda } from '@/app/actions/deudas'
import { errorMessage } from '@/lib/errorMessage'
import type { EstadoDeuda, RegistroDeuda } from '@/types/database'
import { dayBoundsLocal, formatMoneyDivisa, formatMilesEs } from '@/lib/utils'
import { useFechaOperativa } from '@/components/fecha-operativa/FechaOperativaProvider'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'

type Props = {
  tipo: 'DEBEN' | 'DEBO'
  etiquetaPersona: string
}

export function RegistroDeudaForm({ tipo, etiquetaPersona }: Props) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { fecha: fechaOp, esHistorico } = useFechaOperativa()
  const { rows: divisasRows } = useDivisasMaestro()
  const opciones = useMemo(() => (divisasRows.length ? divisasRows : DIVISAS_FALLBACK), [divisasRows])

  const [responsable, setResponsable] = useState('')
  const [divisa, setDivisa] = useState('COP')
  const [monto, setMonto] = useState('')
  const [loading, setLoading] = useState(false)
  const [lista, setLista] = useState<RegistroDeuda[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [montoEditStr, setMontoEditStr] = useState('')

  const cargar = useCallback(async () => {
    setCargandoLista(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLista([])
      setCargandoLista(false)
      return
    }
    const { desde, hastaExclusive } = dayBoundsLocal(fechaOp)

    const { data } = await supabase
      .from('deudas')
      .select('id,responsable,divisa,monto,fecha,estado')
      .eq('usuario_id', user.id)
      .eq('tipo', tipo)
      .gte('fecha', desde)
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })
      .limit(200)
    setLista(
      (data ?? []).map((r) => {
        const row = r as Record<string, unknown>
        return {
          id: String(row.id),
          responsable: String(row.responsable),
          divisa: String(row.divisa),
          monto: Number(row.monto),
          fecha: String(row.fecha),
          estado: (String(row.estado ?? 'PENDIENTE') as EstadoDeuda) || 'PENDIENTE',
        }
      })
    )
    setCargandoLista(false)
  }, [supabase, tipo, fechaOp])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const totalesPorDivisa = useMemo(() => {
    const m = new Map<string, number>()
    for (const row of lista) {
      m.set(row.divisa, (m.get(row.divisa) ?? 0) + row.monto)
    }
    return m
  }, [lista])

  const filaModal = useMemo(() => lista.find((x) => x.id === modalId) ?? null, [lista, modalId])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const parsedMonto = parseFlexibleNumber(monto)
      if (!Number.isFinite(parsedMonto) || parsedMonto <= 0) {
        toast.error('Indique un monto válido.')
        return
      }
      const res = await registrarDeuda({
        tipo,
        responsable,
        divisa,
        monto: parsedMonto,
        fecha: fechaOp,
      })
      if (!res.ok) {
        toast.error('No se guardó', { description: res.error })
        return
      }
      toast.success('Guardado')
      setResponsable('')
      setMonto('')
      await cargar()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const abrirEdicion = (id: string) => {
    const row = lista.find((x) => x.id === id)
    setModalId(id)
    setMontoEditStr(row ? formatMilesEs(row.monto, 4) : '')
  }

  const cerrarModal = () => {
    setModalId(null)
    setMontoEditStr('')
  }

  const confirmarEliminar = async (id: string) => {
    if (!window.confirm('¿Eliminar esta deuda?')) return
    setEliminandoId(id)
    try {
      const res = await eliminarDeuda({ id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Eliminado')
      await cargar()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setEliminandoId(null)
    }
  }

  const confirmarEdicion = async () => {
    if (!filaModal) return
    const n = parseFlexibleNumber(montoEditStr)
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Indique un monto válido.')
      return
    }
    setEditandoId(filaModal.id)
    try {
      const res = await editarDeudaMonto({ id: filaModal.id, monto: n })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(n <= 1e-12 ? 'Saldado' : 'Actualizado')
      cerrarModal()
      await cargar()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setEditandoId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 text-base text-black">
      {esHistorico ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Editando fecha pasada: <span className="font-mono font-semibold">{fechaOp}</span>
        </p>
      ) : null}

      <form onSubmit={guardar} noValidate className="card-pro space-y-3 p-4">
        <div>
          <label className="label" htmlFor="resp">
            {etiquetaPersona}
          </label>
          <input
            id="resp"
            className="input-field min-h-[48px] py-2.5 text-base"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            required
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="div">
            Divisa
          </label>
          <select
            id="div"
            className="input-field min-h-[48px] py-2.5 text-base"
            value={divisa}
            onChange={(e) => setDivisa(e.target.value)}
          >
            {opciones.map((d) => (
              <option key={d.codigo} value={d.codigo}>
                {d.codigo} — {d.nombre_completo}
              </option>
            ))}
          </select>
        </div>
        <MoneyTextField
          id="monto"
          label="Monto"
          maxFrac={2}
          value={monto}
          onChange={setMonto}
          inputClassName="input-field input-numeric min-h-[48px] text-base"
        />
        <button type="submit" disabled={loading} className="btn-primary min-h-[48px] w-full text-base font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
        </button>
      </form>

      <section className="card-pro overflow-hidden p-0">
        {cargandoLista ? (
          <p className="p-4 text-base text-slate-600">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="p-4 text-base text-slate-600">Sin registros para esta fecha.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-header max-w-[140px] text-left">{etiquetaPersona}</th>
                  <th className="table-header text-left">Divisa</th>
                  <th className="table-header text-right">Pendiente</th>
                  <th className="table-header text-left">Fecha</th>
                  <th className="table-header w-28 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="table-cell font-medium">{r.responsable}</td>
                    <td className="table-cell">{r.divisa}</td>
                    <td className="table-cell text-right font-mono">{formatMoneyDivisa(r.monto, r.divisa)}</td>
                    <td className="table-cell text-slate-600">
                      {new Date(r.fecha).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          title="Editar monto"
                          disabled={editandoId === r.id || eliminandoId === r.id}
                          onClick={() => abrirEdicion(r.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {editandoId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Pencil className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          disabled={eliminandoId === r.id || editandoId === r.id}
                          onClick={() => void confirmarEliminar(r.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-700 bg-white text-red-800 hover:bg-red-50 disabled:opacity-50"
                        >
                          {eliminandoId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargandoLista && lista.length > 0 ? (
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
            <ul className="space-y-0.5 text-base text-slate-700">
              {Array.from(totalesPorDivisa.entries()).map(([d, sum]) => (
                <li key={d} className="flex justify-between gap-2">
                  <span>{d}</span>
                  <span className="font-mono font-medium">{formatMilesEs(sum, 2)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {modalId && filaModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) cerrarModal()
          }}
        >
          <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={cerrarModal}
              className="absolute right-2 top-2 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="pr-8 text-base font-bold text-slate-900">Editar deuda</h3>
            <p className="mt-2 text-sm text-slate-600">
              Saldo pendiente:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {formatMoneyDivisa(filaModal.monto, filaModal.divisa)}
              </span>
            </p>
            <div className="mt-3">
              <MoneyTextField
                id="editar-monto"
                label={`Nuevo saldo (${filaModal.divisa})`}
                maxFrac={4}
                value={montoEditStr}
                onChange={setMontoEditStr}
                inputClassName="input-field input-numeric min-h-[48px] text-base"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cerrarModal} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                Cancelar
              </button>
              <button
                type="button"
                disabled={editandoId !== null}
                onClick={() => void confirmarEdicion()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {editandoId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
