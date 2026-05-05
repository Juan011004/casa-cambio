'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fechaLocalYYYYMMDD } from '@/lib/utils'

const STORAGE_KEY = 'casa_cambio_fecha_operativa'

type FechaOperativaContextValue = {
  fecha: string
  setFecha: (f: string) => void
  /** True si la fecha seleccionada es anterior al día calendario actual (modo histórico). */
  esHistorico: boolean
}

const FechaOperativaContext = createContext<FechaOperativaContextValue | null>(null)

export function FechaOperativaProvider({ children }: { children: React.ReactNode }) {
  const [fecha, setFechaState] = useState(() => fechaLocalYYYYMMDD())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        setFechaState(saved)
      }
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, fecha)
    } catch {
      /* ignore */
    }
  }, [fecha, hydrated])

  const setFecha = useCallback((f: string) => {
    setFechaState(f)
  }, [])

  const esHistorico = useMemo(() => fecha < fechaLocalYYYYMMDD(), [fecha])

  const value = useMemo(
    () => ({ fecha, setFecha, esHistorico }),
    [fecha, setFecha, esHistorico]
  )

  return <FechaOperativaContext.Provider value={value}>{children}</FechaOperativaContext.Provider>
}

export function useFechaOperativa(): FechaOperativaContextValue {
  const ctx = useContext(FechaOperativaContext)
  if (!ctx) {
    throw new Error('useFechaOperativa debe usarse dentro de FechaOperativaProvider')
  }
  return ctx
}
