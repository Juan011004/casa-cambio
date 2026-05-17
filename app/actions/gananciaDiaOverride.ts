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
  ganancia_cop: z.number().finite().min(-1e15).max(1e15),
})

/** Fija la ganancia total COP de un día (sobrescribe la suma por moneda en `balances_diarios` y encadena "Debo tener"). */
export async function upsertGananciaDiaOverride(raw: unknown): Promise<ActionResult> {
  const parsed = upsertSchema.safeParse(raw)
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

    const { fecha, ganancia_cop } = parsed.data
    const { error } = await supabase.from('ganancia_dia_override').upsert(
      {
        usuario_id: user.id,
        fecha,
        ganancia_cop,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'usuario_id,fecha' }
    )

    if (error) {
      logServerError('upsertGananciaDiaOverride', new Error(error.message))
      return {
        ok: false,
        error:
          'No se guardó el ajuste. Ejecute `supabase/ganancia_dia_override.sql` en Supabase si la tabla no existe.',
      }
    }

    const rec = await recomputeBalancesDesde({ fecha })
    if (!rec.ok) return { ok: false, error: rec.error }

    revalidatePath('/dashboard')
    revalidatePath('/gastos')
    revalidatePath('/caja')
    return { ok: true }
  } catch (e) {
    logServerError('upsertGananciaDiaOverride', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

/** Quita el ajuste manual de ganancia del día y vuelve al cálculo automático. */
export async function eliminarGananciaDiaOverride(raw: unknown): Promise<ActionResult> {
  const parsed = z.object({ fecha: fechaSchema }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Fecha inválida.' }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { error } = await supabase
      .from('ganancia_dia_override')
      .delete()
      .eq('usuario_id', user.id)
      .eq('fecha', parsed.data.fecha)

    if (error) {
      logServerError('eliminarGananciaDiaOverride', new Error(error.message))
      return { ok: false, error: 'No se pudo quitar el ajuste.' }
    }

    const rec = await recomputeBalancesDesde({ fecha: parsed.data.fecha })
    if (!rec.ok) return { ok: false, error: rec.error }

    revalidatePath('/dashboard')
    revalidatePath('/gastos')
    revalidatePath('/caja')
    return { ok: true }
  } catch (e) {
    logServerError('eliminarGananciaDiaOverride', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
