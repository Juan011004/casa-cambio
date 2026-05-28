'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'

const STORAGE_KEY = 'casa-cambio-politica-datos-aceptada'

type PoliticaDatosContextValue = {
  aceptada: boolean
  setAceptada: (value: boolean) => void
}

const PoliticaDatosContext = createContext<PoliticaDatosContextValue | null>(null)

function readStored(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(STORAGE_KEY) === '1'
}

function writeStored(value: boolean) {
  if (typeof window === 'undefined') return
  if (value) window.sessionStorage.setItem(STORAGE_KEY, '1')
  else window.sessionStorage.removeItem(STORAGE_KEY)
}

export function clearPoliticaDatosAceptada() {
  writeStored(false)
}

export function PoliticaDatosProvider({ children }: { children: React.ReactNode }) {
  const [aceptada, setAceptadaState] = useState(false)

  useEffect(() => {
    setAceptadaState(readStored())
  }, [])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        writeStored(false)
        setAceptadaState(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const setAceptada = useCallback((value: boolean) => {
    writeStored(value)
    setAceptadaState(value)
  }, [])

  const value = useMemo(() => ({ aceptada, setAceptada }), [aceptada, setAceptada])

  return <PoliticaDatosContext.Provider value={value}>{children}</PoliticaDatosContext.Provider>
}

export function usePoliticaDatos() {
  const ctx = useContext(PoliticaDatosContext)
  if (!ctx) {
    throw new Error('usePoliticaDatos debe usarse dentro de PoliticaDatosProvider')
  }
  return ctx
}
