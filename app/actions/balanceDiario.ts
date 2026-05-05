'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { logServerError } from '@/lib/server/server-log'
import { computeBalanceDiarioUpsert } from '@/lib/balanceDiarioCompute'

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

/** Calcula y guarda (o actualiza) el snapshot diario en `balances_diarios`. */
export async function upsertBalanceDiarioSnapshot(raw: unknown): Promise<ActionResult> {
  const parsed = z.object({ fecha: fechaSchema }).safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().formErrors[0] ?? 'Datos inválidos.' }
  }
  const { fecha } = parsed.data

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const row = await computeBalanceDiarioUpsert(supabase, user.id, fecha)

    const { error } = await supabase.from('balances_diarios').upsert(row, {
      onConflict: 'usuario_id,fecha',
    })

    if (error) {
      logServerError('upsertBalanceDiarioSnapshot', new Error(error.message))
      return {
        ok: false,
        error:
          'No se guardó el backup diario. Ejecute `supabase/balances_diarios.sql` en Supabase si la tabla no existe.',
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/gastos')
    revalidatePath('/caja')
    return { ok: true }
  } catch (e) {
    logServerError('upsertBalanceDiarioSnapshot', e)
    return { ok: false, error: 'Error inesperado al guardar el backup.' }
  }
}
