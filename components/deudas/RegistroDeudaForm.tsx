'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { registrarDeuda, abonarDeuda } from '@/app/actions/deudas'
import { errorMessage } from '@/lib/errorMessage'
import type { EstadoDeuda, RegistroDeuda } from '@/types/database'
import { formatCOP, formatMoneyDivisa, formatMilesEs } from '@/lib/utils'
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

  const [totalSnapshotCierreFmt, setTotalSnapshotCierreFmt] = useState<string | null>(null)

  const [responsable, setResponsable] = useState('')
  const [divisa, setDivisa] = useState('COP')
  const [monto, setMonto] = useState('')
  const [loading, setLoading] = useState(false)
  const [lista, setLista] = useState<RegistroDeuda[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [abonandoId, setAbonandoId] = useState<string | null>(null)
  const [modalId, setModalId] = useState<string | null>(null)
  const [abonoStr, setAbonoStr] = useState('')

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
    const { data } = await supabase
      .from('deudas')
      .select('id,responsable,divisa,monto,fecha,estado')
      .eq('usuario_id', user.id)
      .eq('tipo', tipo)
      .eq('estado', 'PENDIENTE')
      .order('fecha', { ascending: false })
      .limit(100)
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
  }, [supabase, tipo])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!esHistorico) {
      setTotalSnapshotCierreFmt(null)
      return
    }
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data } = await supabase
        .from('balances_diarios')
        .select('me_deben_total,debo_total')
        .eq('usuario_id', user.id)
        .eq('fecha', fechaOp)
        .maybeSingle()
      if (cancelled) return
      if (!data) {
        setTotalSnapshotCierreFmt(null)
        return
      }
      const n = tipo === 'DEBEN' ? Number(data.me_deben_total) : Number(data.debo_total)
      setTotalSnapshotCierreFmt(formatCOP(n))
    })()
    return () => {
      cancelled = true
    }
  }, [esHistorico, fechaOp, tipo, supabase])

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
    if (esHistorico) {
      toast.error('No puede registrar deudas en una fecha histórica.')
      return
    }
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

  const abrirAbono = (id: string) => {
    const row = lista.find((x) => x.id === id)
    setModalId(id)
    setAbonoStr(row ? formatMilesEs(row.monto, 4) : '')
  }

  const cerrarModal = () => {
    setModalId(null)
    setAbonoStr('')
  }

  const confirmarAbono = async () => {
    if (!filaModal) return
    const n = parseFlexibleNumber(abonoStr)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Indique un abono válido.')
      return
    }
    if (n > filaModal.monto + 1e-9) {
      toast.error('El abono supera el saldo.')
      return
    }
    setAbonandoId(filaModal.id)
    try {
      const res = await abonarDeuda({ id: filaModal.id, monto_abono: n })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(n >= filaModal.monto - 1e-9 ? 'Saldado' : 'Abono registrado')
      cerrarModal()
      await cargar()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setAbonandoId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 text-base text-black">
      {esHistorico ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          <p>
            Viendo datos históricos del <span className="font-mono font-semibold">{fechaOp}</span>. La lista muestra deudas
            vigentes; el total en COP del backup de cierre ese día es referencial.
          </p>
          {totalSnapshotCierreFmt ? (
            <p className="font-mono text-base font-semibold text-slate-900">
              Total en COP al cierre ({tipo === 'DEBEN' ? 'Me deben' : 'Debo'}): {totalSnapshotCierreFmt}
            </p>
          ) : (
            <p className="text-slate-600">Sin snapshot en balances_diarios para esa fecha.</p>
          )}
        </div>
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
            disabled={esHistorico}
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
            disabled={esHistorico}
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
          disabled={esHistorico}
          value={monto}
          onChange={setMonto}
          inputClassName="input-field input-numeric min-h-[48px] text-base"
        />
        <button type="submit" disabled={loading || esHistorico} className="btn-primary min-h-[48px] w-full text-base font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
        </button>
      </form>

      <section className="card-pro overflow-hidden p-0">
        {cargandoLista ? (
          <p className="p-4 text-base text-slate-600">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="p-4 text-base text-slate-600">Sin registros pendientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="table-header max-w-[140px] text-left">{etiquetaPersona}</th>
                  <th className="table-header text-left">Divisa</th>
                  <th className="table-header text-right">Pendiente</th>
                  <th className="table-header text-left">Fecha</th>
                  <th className="table-header w-24">Abonar</th>
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
                      <button
                        type="button"
                        title="Abonar"
                        disabled={abonandoId === r.id || esHistorico}
                        onClick={() => abrirAbono(r.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        {abonandoId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                      </button>
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
            <h3 className="pr-8 text-base font-bold text-slate-900">Abonar deuda</h3>
            <p className="mt-2 text-sm text-slate-600">
              Saldo pendiente:{' '}
              <span className="font-mono font-semibold text-slate-900">
                {formatMoneyDivisa(filaModal.monto, filaModal.divisa)}
              </span>
            </p>
            <div className="mt-3">
              <MoneyTextField
                id="abono-monto"
                label={`Abono (${filaModal.divisa})`}
                maxFrac={4}
                value={abonoStr}
                onChange={setAbonoStr}
                inputClassName="input-field input-numeric min-h-[48px] text-base"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cerrarModal} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                Cancelar
              </button>
              <button
                type="button"
                disabled={abonandoId !== null}
                onClick={() => void confirmarAbono()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {abonandoId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
