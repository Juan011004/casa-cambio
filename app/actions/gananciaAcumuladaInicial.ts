'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { logServerError } from '@/lib/server/server-log'

const upsertSchema = z.object({
  monto_cop: z.number().finite().min(-1e15).max(1e15),
})

/** Fija el acumulado de ganancias previo al uso de la app (una fila por usuario). */
export async function upsertGananciaAcumuladaInicial(raw: unknown): Promise<ActionResult> {
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

    const { error } = await supabase.from('ganancia_acumulada_inicial').upsert(
      {
        usuario_id: user.id,
        monto_cop: parsed.data.monto_cop,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'usuario_id' }
    )

    if (error) {
      logServerError('upsertGananciaAcumuladaInicial', new Error(error.message))
      return {
        ok: false,
        error:
          'No se guardó. Ejecute `supabase/ganancia_acumulada_inicial.sql` en Supabase si la tabla no existe.',
      }
    }

    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('upsertGananciaAcumuladaInicial', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

/** Pone el acumulado inicial en cero. */
export async function eliminarGananciaAcumuladaInicial(): Promise<ActionResult> {
  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { error } = await supabase.from('ganancia_acumulada_inicial').delete().eq('usuario_id', user.id)

    if (error) {
      logServerError('eliminarGananciaAcumuladaInicial', new Error(error.message))
      return { ok: false, error: 'No se pudo quitar el acumulado inicial.' }
    }

    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('eliminarGananciaAcumuladaInicial', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
