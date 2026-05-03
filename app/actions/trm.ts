'use server'

import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { CopPorUnidad } from '@/lib/trm'
import type { TrmMercadoFila } from '@/lib/trm-ticker'
import { syncTrmMercadoFromExchange, trmCacheIsStale } from '@/lib/trm-sync-server'
import { logServerError } from '@/lib/server/server-log'

export type { TrmMercadoFila }

function rowsToCopMap(rows: { codigo: string; valor_cop: number }[]): CopPorUnidad {
  const out: CopPorUnidad = {
    USD: 0,
    EUR: 0,
    GBP: 0,
    BRL: 0,
    MXN: 0,
    CAD: 0,
    CLP: 0,
    PEN: 0,
    ARS: 0,
    AUD: 0,
    COP: 1,
    OTRO: 0,
  }
  for (const r of rows) {
    const v = Number(r.valor_cop)
    if (Number.isFinite(v) && v > 0) {
      out[r.codigo] = v
    }
  }
  if (!out.OTRO && out.USD) out.OTRO = out.USD
  return out
}

function pickUltimaActualizacion(rows: { ultima_actualizacion: string }[]): string | null {
  if (!rows.length) return null
  let max = 0
  let s: string | null = null
  for (const r of rows) {
    const t = new Date(r.ultima_actualizacion).getTime()
    if (Number.isFinite(t) && t >= max) {
      max = t
      s = r.ultima_actualizacion
    }
  }
  return s
}

/**
 * Lee TRM desde Supabase. Refresco perezoso: si la caché tiene > 60 min o está vacía
 * (y existe SUPABASE_SERVICE_ROLE_KEY en el servidor), sincroniza desde la API antes de devolver.
 * Así el Dashboard mantiene datos al día sin depender de cron en Vercel Hobby.
 */
export async function obtenerTrmMercado(): Promise<{
  ok: true
  rates: CopPorUnidad
  filas: TrmMercadoFila[]
  ultimaActualizacion: string | null
}> {
  try {
    const supabase = createServerActionClient({ cookies })

    let { data: rows } = await supabase.from('trm_mercado').select('codigo,nombre,valor_cop,ultima_actualizacion')

    let ultima = pickUltimaActualizacion(rows ?? [])
    if (trmCacheIsStale(ultima) || !(rows?.length)) {
      await syncTrmMercadoFromExchange()
      const again = await supabase.from('trm_mercado').select('codigo,nombre,valor_cop,ultima_actualizacion')
      rows = again.data ?? rows
      ultima = pickUltimaActualizacion(rows ?? [])
    }

    const list = (rows ?? []) as TrmMercadoFila[]
    const rates = rowsToCopMap(rows ?? [])

    return {
      ok: true,
      rates,
      filas: list,
      ultimaActualizacion: ultima,
    }
  } catch (e) {
    logServerError('obtenerTrmMercado', e)
    const fallback: CopPorUnidad = {
      USD: 0,
      EUR: 0,
      GBP: 0,
      BRL: 0,
      MXN: 0,
      CAD: 0,
      CLP: 0,
      PEN: 0,
      ARS: 0,
      AUD: 0,
      COP: 1,
      OTRO: 0,
    }
    return {
      ok: true,
      rates: fallback,
      filas: [],
      ultimaActualizacion: null,
    }
  }
}
