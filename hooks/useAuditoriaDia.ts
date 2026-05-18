'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { dayBoundsLocal } from '@/lib/utils'
import {
  filasAuditoriaVivo,
  monedasParaAuditoria,
  type AuditoriaOverrideVals,
  type FilaAuditoriaViva,
} from '@/lib/auditoriaVivo'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import type { Transaccion } from '@/types/database'

export function useAuditoriaDia(fecha: string, enabled = true) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { rows: divisasMaestro } = useDivisasMaestro()
  const divisas = useMemo(() => (divisasMaestro.length ? divisasMaestro : DIVISAS_FALLBACK), [divisasMaestro])

  const [loading, setLoading] = useState(true)
  const [txRows, setTxRows] = useState<Transaccion[]>([])
  const [invRows, setInvRows] = useState<{ divisa: string }[]>([])
  const [cierresPrevRows, setCierresPrevRows] = useState<CierreRowParaArrastre[]>([])
  const [auditOverrides, setAuditOverrides] = useState<Map<string, AuditoriaOverrideVals>>(() => new Map())

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setTxRows([])
      setInvRows([])
      setCierresPrevRows([])
      setAuditOverrides(new Map())
      setLoading(false)
      return
    }

    const { desde, hastaExclusive } = dayBoundsLocal(fecha)
    const [txRes, cPrevRes, invRes, ovRes] = await Promise.all([
      supabase
        .from('transacciones')
        .select('*')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase
        .from('cierres_diarios')
        .select('moneda,fecha,cierre_manual,promedio_compra,promedio_compra_acumulado,id,created_at')
        .eq('usuario_id', user.id)
        .lt('fecha', fecha),
      supabase.from('inventario').select('divisa,cantidad_actual').eq('usuario_id', user.id),
      supabase
        .from('auditoria_overrides')
        .select('moneda,cantidad_inicial,promedio_anterior,promedio_compra_hoy,ganancia_cop')
        .eq('usuario_id', user.id)
        .eq('fecha', fecha),
    ])

    setTxRows((txRes.data ?? []) as Transaccion[])
    setCierresPrevRows((cPrevRes.error ? [] : cPrevRes.data) as CierreRowParaArrastre[])
    setInvRows(
      (invRes.error ? [] : invRes.data ?? []).map((r) => ({
        divisa: String((r as { divisa?: string }).divisa ?? '').toUpperCase(),
      }))
    )

    const ovMap = new Map<string, AuditoriaOverrideVals>()
    for (const r of ovRes.error ? [] : ovRes.data ?? []) {
      const row = r as Record<string, unknown>
      const mon = String(row.moneda ?? '').toUpperCase()
      if (!mon) continue
      ovMap.set(mon, {
        cantidad_inicial: row.cantidad_inicial != null ? Number(row.cantidad_inicial) : null,
        promedio_anterior: row.promedio_anterior != null ? Number(row.promedio_anterior) : null,
        promedio_compra_hoy: row.promedio_compra_hoy != null ? Number(row.promedio_compra_hoy) : null,
        ganancia_cop: row.ganancia_cop != null ? Number(row.ganancia_cop) : null,
      })
    }
    setAuditOverrides(ovMap)
    setLoading(false)
  }, [supabase, fecha, enabled])

  useEffect(() => {
    void load()
  }, [load])

  const ultimoCierrePorMoneda = useMemo(
    () => saldoPromedioPorMonedaDesdeCierres(cierresPrevRows),
    [cierresPrevRows]
  )

  const filas: FilaAuditoriaViva[] = useMemo(() => {
    const monedas = monedasParaAuditoria(txRows, invRows, ultimoCierrePorMoneda)
    return filasAuditoriaVivo(txRows, ultimoCierrePorMoneda, monedas, auditOverrides)
  }, [txRows, invRows, ultimoCierrePorMoneda, auditOverrides])

  const etiquetaMoneda = useCallback(
    (codigo: string) => {
      const d = divisas.find((x) => x.codigo === codigo)
      return d ? `${d.nombre_completo} (${codigo})` : codigo
    },
    [divisas]
  )

  return { loading, filas, auditOverrides, etiquetaMoneda, reload: load }
}
