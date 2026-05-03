'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { errorMessage } from '@/lib/errorMessage'
import type { TrmRegistro } from '@/types/database'

export type TrmTrend = 'alza' | 'baja' | 'estable'

export function useTRM(lookbackHours = 168) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registros, setRegistros] = useState<TrmRegistro[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()
      const { data, error: qErr } = await supabase
        .from('registro_trm')
        .select('valor, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(24)

      if (qErr) throw qErr
      setRegistros((data ?? []) as TrmRegistro[])
    } catch (e: unknown) {
      setError(errorMessage(e))
      setRegistros([])
    } finally {
      setLoading(false)
    }
  }, [supabase, lookbackHours])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  const sortedAsc = useMemo(() => [...registros].sort((a, b) => a.created_at.localeCompare(b.created_at)), [registros])

  const toNum = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const valorActual = sortedAsc.length ? toNum(sortedAsc[sortedAsc.length - 1]?.valor) : null
  const valorPrevio = sortedAsc.length >= 2 ? toNum(sortedAsc[sortedAsc.length - 2]?.valor) : null

  let trend: TrmTrend = 'estable'
  let delta: number | null = null
  if (valorActual != null && valorPrevio != null) {
    delta = valorActual - valorPrevio
    if (delta > 0) trend = 'alza'
    else if (delta < 0) trend = 'baja'
    else trend = 'estable'
  }

  return {
    loading,
    error,
    registros,
    valorActual,
    valorPrevio,
    delta,
    trend,
    refresh,
  }
}
