'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { logServerError } from '@/lib/server/server-log'
import { recomputeBalancesDesde } from '@/app/actions/balanceDiario'

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

const upsertSchema = z.object({
  fecha: fechaSchema,
  precios: z
    .record(z.string().min(2).max(12), z.number().finite().min(0))
    .refine((m) => Object.keys(m).length <= 60, 'Demasiadas monedas'),
})

/** UPSERT de precios de compra por día (caja_precios). */
export async function upsertCajaPrecios(raw: unknown): Promise<ActionResult> {
  const parsed = upsertSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { fecha, precios } = parsed.data
    const payload = Object.entries(precios).map(([moneda, precio_compra]) => ({
      usuario_id: user.id,
      fecha,
      moneda: moneda.toUpperCase(),
      precio_compra,
    }))

    if (payload.length === 0) return { ok: true }

    const { error } = await supabase.from('caja_precios').upsert(payload, { onConflict: 'usuario_id,fecha,moneda' })
    if (error) {
      logServerError('upsertCajaPrecios', new Error(error.message))
      return { ok: false, error: 'No se pudieron guardar los precios.' }
    }

    const rec = await recomputeBalancesDesde({ fecha })
    if (!rec.ok) return { ok: false, error: rec.error }

    revalidatePath('/caja')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('upsertCajaPrecios', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

