'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { guardarCargaInicial } from '@/app/actions/caja'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { errorMessage } from '@/lib/errorMessage'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { fechaLocalYYYYMMDD } from '@/lib/utils'
import { useFechaOperativa } from '@/components/fecha-operativa/FechaOperativaProvider'
import { AceptacionPoliticaDatos } from '@/components/legal/AceptacionPoliticaDatos'
import { usePoliticaDatos } from '@/components/legal/PoliticaDatosProvider'

export function CargaInicialDialog({
  open,
  onClose,
  onGuardado,
}: {
  open: boolean
  onClose: () => void
  onGuardado: () => void
}) {
  const { fecha: fechaOperativa } = useFechaOperativa()
  const { rows } = useDivisasMaestro()
  const opciones = useMemo(() => (rows.length ? rows : DIVISAS_FALLBACK), [rows])
  const [fecha, setFecha] = useState(() => fechaLocalYYYYMMDD())
  const [divisa, setDivisa] = useState('USD')
  const [cantidad, setCantidad] = useState('')
  const [promedio, setPromedio] = useState('')
  const [loading, setLoading] = useState(false)
  const { aceptada: aceptaPolitica } = usePoliticaDatos()

  useEffect(() => {
    if (!open) return
    // Por defecto, aplica a la fecha operativa global (para editar días pasados desde Dashboard).
    setFecha(fechaOperativa)
    setCantidad('')
    setPromedio('')
  }, [open, fechaOperativa])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = parseFlexibleNumber(cantidad)
    const p = parseFlexibleNumber(promedio)
    if (!Number.isFinite(c) || c <= 0) {
      toast.error('Indique una cantidad válida mayor a 0.')
      return
    }
    if (!Number.isFinite(p) || p <= 0) {
      toast.error('Indique un promedio de compra (COP/unidad) mayor a 0.')
      return
    }
    setLoading(true)
    try {
      const res = await guardarCargaInicial({
        fecha,
        divisa,
        cantidad: c,
        promedio_compra: p,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Carga inicial guardada')
      onGuardado()
      onClose()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="carga-inicial-title"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 id="carga-inicial-title" className="pr-8 text-sm font-bold text-slate-900">
          Carga inicial
        </h3>
        <p className="mt-1 text-[11px] leading-snug text-slate-600">
          Punto cero para clientes que migran desde papel: cantidad física en caja y su costo promedio (COP por unidad
          de divisa).
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-3 text-[13px]">
          <div>
            <label className="label" htmlFor="ci-fecha">
              Fecha efectiva
            </label>
            <input
              id="ci-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="input-field min-h-[40px] w-full max-w-[200px]"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="ci-divisa">
              Divisa
            </label>
            <select
              id="ci-divisa"
              value={divisa}
              onChange={(e) => setDivisa(e.target.value)}
              className="input-field min-h-[40px] w-full py-1.5"
            >
              {opciones.map((d) => (
                <option key={d.codigo} value={d.codigo}>
                  {d.codigo} — {d.nombre_completo}
                </option>
              ))}
            </select>
          </div>
          <MoneyTextField
            id="ci-cantidad"
            label="Cantidad en caja"
            maxFrac={4}
            value={cantidad}
            onChange={setCantidad}
          />
          <MoneyTextField
            id="ci-promedio"
            label="Promedio de compra (COP / unidad)"
            maxFrac={2}
            value={promedio}
            onChange={setPromedio}
          />
          <AceptacionPoliticaDatos id="acepta-politica-carga-inicial" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !aceptaPolitica}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
