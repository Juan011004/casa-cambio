import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/database'
import { fetchTrmRowsFromExchangeApi } from '@/lib/trm-exchange'

const STALE_MS = 60 * 60 * 1000

export async function syncTrmMercadoFromExchange(): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY o URL.' }
  }

  try {
    const rows = await fetchTrmRowsFromExchangeApi()
    const now = new Date().toISOString()
    const admin = createClient<Database>(url, key)
    const payload = rows.map((r) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      valor_cop: r.valor_cop,
      ultima_actualizacion: now,
    }))
    const { error } = await admin.from('trm_mercado').upsert(payload, { onConflict: 'codigo' })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

export function trmCacheIsStale(ultima: string | null | undefined): boolean {
  if (!ultima) return true
  const t = new Date(ultima).getTime()
  if (!Number.isFinite(t)) return true
  return Date.now() - t > STALE_MS
}
