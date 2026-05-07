'use client'

import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { useEffect, useState } from 'react'
import { useFechaOperativa } from '@/components/fecha-operativa/FechaOperativaProvider'
import { fechaLocalYYYYMMDD } from '@/lib/utils'
import { ensureSnapshotAyer } from '@/app/actions/balanceDiario'

export function Header() {
  const [userLabel, setUserLabel] = useState('')
  const { fecha, setFecha, esHistorico } = useFechaOperativa()

  const maxFecha = fechaLocalYYYYMMDD()

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserLabel(data.user?.email?.split('@')[0] ?? '')
    })
  }, [])

  // Auto-cierre (fallback): asegura snapshot de ayer al abrir la app.
  useEffect(() => {
    void ensureSnapshotAyer()
  }, [])

  return (
    <header className="sticky top-0 z-30 flex min-h-[44px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-3 py-2 lg:px-5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:gap-3">
        <label htmlFor="fecha-global" className="sr-only">
          Fecha operativa
        </label>
        <span className="hidden text-xs font-bold uppercase tracking-wide text-slate-600 sm:inline">
          Fecha
        </span>
        <input
          id="fecha-global"
          type="date"
          max={maxFecha}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="input-field max-w-[200px] min-h-[40px] shrink-0 text-sm"
        />
        {esHistorico ? (
          <span className="truncate text-xs font-medium text-amber-800">Editando fecha pasada: {fecha}</span>
        ) : null}
      </div>
      {userLabel ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-md border border-slate-100 bg-white px-2 py-1 text-xs font-semibold uppercase text-black shadow-sm">
            {userLabel.charAt(0)}
          </span>
          <span className="max-w-[160px] truncate text-sm font-medium text-black">{userLabel}</span>
        </div>
      ) : null}
    </header>
  )
}
