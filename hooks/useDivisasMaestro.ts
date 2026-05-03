'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { DIVISAS_FALLBACK, type DivisaOpcion } from '@/lib/divisasCatalog'

export type { DivisaOpcion }

export function useDivisasMaestro() {
  const supabase = createBrowserSupabaseClient()
  const [rows, setRows] = useState<DivisaOpcion[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('divisas')
      .select('codigo,nombre_completo')
      .eq('activo', true)
      .order('codigo')
    if (error || !data?.length) {
      setRows(DIVISAS_FALLBACK)
    } else {
      setRows(
        data.map((d) => ({
          codigo: String((d as Record<string, unknown>).codigo),
          nombre_completo:
            (d as Record<string, unknown>).nombre_completo != null
              ? String((d as Record<string, unknown>).nombre_completo)
              : String((d as Record<string, unknown>).codigo),
        }))
      )
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  return { rows, loading, refresh: load }
}
