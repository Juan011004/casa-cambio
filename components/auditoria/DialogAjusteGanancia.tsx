'use client'

import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { addDaysYYYYMMDD, formatMilesEs } from '@/lib/utils'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { eliminarGananciaDiaOverride, upsertGananciaDiaOverride } from '@/app/actions/gananciaDiaOverride'
import { upsertGananciaAcumuladaInicial } from '@/app/actions/gananciaAcumuladaInicial'

type Modo = 'dia' | 'arranque'

type Props = {
  open: boolean
  onClose: () => void
  fechaDia: string
  gananciaAcumInicialCop: number
  onSaved: () => void | Promise<void>
}

export function DialogAjusteGanancia({ open, onClose, fechaDia, gananciaAcumInicialCop, onSaved }: Props) {
  const [modo, setModo] = useState<Modo>('dia')
  const [dialogGanFecha, setDialogGanFecha] = useState('')
  const [dialogGanMonto, setDialogGanMonto] = useState('')
  const [dialogAcumInicialMonto, setDialogAcumInicialMonto] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    const f = addDaysYYYYMMDD(fechaDia, -1)
    setModo('dia')
    setDialogGanFecha(f)
    setDialogGanMonto('')
    setDialogAcumInicialMonto(
      Math.abs(gananciaAcumInicialCop) > 1e-6 ? formatMilesEs(gananciaAcumInicialCop, 2) : ''
    )
  }, [open, fechaDia, gananciaAcumInicialCop])

  useEffect(() => {
    if (!open || modo !== 'dia' || !/^\d{4}-\d{2}-\d{2}$/.test(dialogGanFecha)) return
    let cancelled = false
    void (async () => {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id || cancelled) return
      const { data } = await supabase
        .from('ganancia_dia_override')
        .select('ganancia_cop')
        .eq('usuario_id', user.id)
        .eq('fecha', dialogGanFecha)
        .maybeSingle()
      if (cancelled) return
      const g =
        data != null && (data as { ganancia_cop?: unknown }).ganancia_cop != null
          ? Number((data as { ganancia_cop: unknown }).ganancia_cop)
          : null
      setDialogGanMonto(g != null && Number.isFinite(g) ? formatMilesEs(g, 2) : '')
    })()
    return () => {
      cancelled = true
    }
  }, [open, modo, dialogGanFecha])

  if (!open) return null

  const onGuardar = async () => {
    setGuardando(true)
    try {
      if (modo === 'dia') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dialogGanFecha)) {
          toast.error('Elija una fecha válida.')
          return
        }
        if (dialogGanFecha > fechaDia) {
          toast.error('La fecha no puede ser posterior al día operativo.')
          return
        }
        const n = parseFlexibleNumber(dialogGanMonto)
        if (!dialogGanMonto.trim() || !Number.isFinite(n)) {
          toast.error('Indique un monto COP válido.')
          return
        }
        const res = await upsertGananciaDiaOverride({ fecha: dialogGanFecha, ganancia_cop: n })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Ganancia del día guardada')
      } else {
        const n = parseFlexibleNumber(dialogAcumInicialMonto)
        if (!dialogAcumInicialMonto.trim() || !Number.isFinite(n)) {
          toast.error('Indique un monto válido.')
          return
        }
        const res = await upsertGananciaAcumuladaInicial({ monto_cop: n })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Acumulado de arranque guardado')
      }
      onClose()
      await onSaved()
    } finally {
      setGuardando(false)
    }
  }

  const onRestaurarDia = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dialogGanFecha)) {
      toast.error('Elija una fecha válida.')
      return
    }
    setGuardando(true)
    try {
      const res = await eliminarGananciaDiaOverride({ fecha: dialogGanFecha })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Se usa el cálculo automático')
      setDialogGanMonto('')
      onClose()
      await onSaved()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-4"
      role="presentation"
      onClick={() => {
        if (!guardando) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gan-dialog-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 id="gan-dialog-titulo" className="text-lg font-bold text-slate-900">
            Ajustar ganancias
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModo('dia')}
            className={`min-h-[44px] rounded-lg text-sm font-bold ${
              modo === 'dia' ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-800'
            }`}
          >
            Ganancia del día
          </button>
          <button
            type="button"
            onClick={() => setModo('arranque')}
            className={`min-h-[44px] rounded-lg text-sm font-bold ${
              modo === 'arranque' ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-800'
            }`}
          >
            Acumulado arranque
          </button>
        </div>

        {modo === 'dia' ? (
          <div className="space-y-3">
            <div>
              <label htmlFor="gan-dia-fecha" className="mb-1 block text-sm font-semibold text-slate-700">
                Fecha
              </label>
              <input
                id="gan-dia-fecha"
                type="date"
                max={fechaDia}
                value={dialogGanFecha}
                onChange={(e) => setDialogGanFecha(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base font-mono"
              />
            </div>
            <div>
              <label htmlFor="gan-dia-monto" className="mb-1 block text-sm font-semibold text-slate-700">
                Ganancia total (COP)
              </label>
              <input
                id="gan-dia-monto"
                type="text"
                inputMode="decimal"
                placeholder="Ej. 850000"
                value={dialogGanMonto}
                onChange={(e) => setDialogGanMonto(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base font-mono"
              />
            </div>
            <button
              type="button"
              disabled={guardando}
              onClick={() => void onRestaurarDia()}
              className="text-sm font-semibold text-slate-600 underline hover:text-slate-900 disabled:opacity-50"
            >
              Usar cálculo automático de ese día
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="gan-acum-inicial" className="mb-1 block text-sm font-semibold text-slate-700">
              Total previo al sistema (COP)
            </label>
            <input
              id="gan-acum-inicial"
              type="text"
              inputMode="decimal"
              placeholder="Ej. 12500000"
              value={dialogAcumInicialMonto}
              onChange={(e) => setDialogAcumInicialMonto(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base font-mono"
            />
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={guardando}
            onClick={onClose}
            className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-800"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void onGuardar()}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
