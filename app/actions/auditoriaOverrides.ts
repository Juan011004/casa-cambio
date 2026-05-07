'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { logServerError } from '@/lib/server/server-log'

const schema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  moneda: z.string().min(2).max(12),
  cantidad_inicial: z.number().finite().nonnegative().optional(),
  promedio_anterior: z.number().finite().nonnegative().optional(),
  promedio_compra_hoy: z.number().finite().nonnegative().optional(),
})

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

    const payload = {
      usuario_id: user.id,
      fecha: parsed.data.fecha,
      moneda: parsed.data.moneda.toUpperCase(),
      cantidad_inicial: parsed.data.cantidad_inicial ?? null,
      promedio_anterior: parsed.data.promedio_anterior ?? null,
      promedio_compra_hoy: parsed.data.promedio_compra_hoy ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('auditoria_overrides')
      .upsert(payload as any, { onConflict: 'usuario_id,fecha,moneda' })

    if (error) {
      logServerError('upsertAuditoriaOverride', new Error(error.message))
      return {
        ok: false,
        error:
          'No se guardó el override. Ejecute `supabase/auditoria_overrides.sql` en Supabase si falta la tabla.',
      }
    }

    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('upsertAuditoriaOverride', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

