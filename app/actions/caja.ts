'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { ActionResult } from '@/types/database'
import { cajaGuardarSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'

export async function guardarCajaDiaria(raw: unknown): Promise<ActionResult> {
  const parsed = cajaGuardarSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.flatten().formErrors.concat(
      Object.values(parsed.error.flatten().fieldErrors).flat()
    )
    return { ok: false, error: issues[0] ?? 'Datos inválidos.' }
  }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { fecha, tipo, montos } = parsed.data

    const { error: delErr } = await supabase
      .from('caja_diaria')
      .delete()
      .eq('usuario_id', user.id)
      .eq('fecha', fecha)
      .eq('tipo', tipo)

    if (delErr) {
      logServerError('guardarCajaDiaria/delete', new Error(delErr.message))
      return { ok: false, error: 'No se pudo actualizar la caja.' }
    }

    const rows = Object.entries(montos)
      .filter(([, m]) => Number.isFinite(m))
      .map(([moneda, monto]) => ({
        usuario_id: user.id,
        fecha,
        tipo,
        moneda: moneda.toUpperCase(),
        monto,
      }))

    if (rows.length === 0) {
      revalidatePath('/caja')
      revalidatePath('/dashboard')
      return { ok: true }
    }

    const { error: insErr } = await supabase.from('caja_diaria').insert(rows)
    if (insErr) {
      logServerError('guardarCajaDiaria/insert', new Error(insErr.message))
      return { ok: false, error: 'No se pudo guardar la caja.' }
    }

    revalidatePath('/caja')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('guardarCajaDiaria', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
