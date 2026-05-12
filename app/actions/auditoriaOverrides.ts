'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { logServerError } from '@/lib/server/server-log'
import { recomputeBalancesDesde } from '@/app/actions/balanceDiario'

const schema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  moneda: z.string().min(2).max(12),
  cantidad_inicial: z.number().finite().nonnegative().optional(),
  promedio_anterior: z.number().finite().nonnegative().optional(),
  promedio_compra_hoy: z.number().finite().nonnegative().optional(),
  ganancia_cop: z.union([z.number().finite(), z.null()]).optional(),
})

function hasKey(raw: unknown, key: string): boolean {
  return typeof raw === 'object' && raw !== null && Object.prototype.hasOwnProperty.call(raw, key)
}

export async function upsertAuditoriaOverride(raw: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Datos inválidos.'
    return { ok: false, error: first }
  }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const moneda = parsed.data.moneda.toUpperCase()

    const { data: existing, error: selErr } = await supabase
      .from('auditoria_overrides')
      .select('cantidad_inicial,promedio_anterior,promedio_compra_hoy,ganancia_cop')
      .eq('usuario_id', user.id)
      .eq('fecha', parsed.data.fecha)
      .eq('moneda', moneda)
      .maybeSingle()

    if (selErr) {
      logServerError('upsertAuditoriaOverride/select', new Error(selErr.message))
    }

    const ex = (existing ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = {
      usuario_id: user.id,
      fecha: parsed.data.fecha,
      moneda,
      cantidad_inicial: ex.cantidad_inicial ?? null,
      promedio_anterior: ex.promedio_anterior ?? null,
      promedio_compra_hoy: ex.promedio_compra_hoy ?? null,
      ganancia_cop: ex.ganancia_cop ?? null,
      updated_at: new Date().toISOString(),
    }

    if (hasKey(raw, 'cantidad_inicial')) merged.cantidad_inicial = parsed.data.cantidad_inicial ?? null
    if (hasKey(raw, 'promedio_anterior')) merged.promedio_anterior = parsed.data.promedio_anterior ?? null
    if (hasKey(raw, 'promedio_compra_hoy')) merged.promedio_compra_hoy = parsed.data.promedio_compra_hoy ?? null
    if (hasKey(raw, 'ganancia_cop')) merged.ganancia_cop = parsed.data.ganancia_cop ?? null

    const { error } = await supabase
      .from('auditoria_overrides')
      .upsert(merged as never, { onConflict: 'usuario_id,fecha,moneda' })

    if (error) {
      logServerError('upsertAuditoriaOverride', new Error(error.message))
      return {
        ok: false,
        error:
          'No se guardó el override. Ejecute `supabase/auditoria_overrides.sql` y `supabase/auditoria_overrides_add_ganancia_cop.sql` en Supabase si faltan columnas.',
      }
    }

    const rec = await recomputeBalancesDesde({ fecha: parsed.data.fecha })
    if (!rec.ok) return { ok: false, error: rec.error }

    revalidatePath('/dashboard')
    revalidatePath('/gastos')
    revalidatePath('/caja')
    return { ok: true }
  } catch (e) {
    logServerError('upsertAuditoriaOverride', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
