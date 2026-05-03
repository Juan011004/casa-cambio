'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { ActionResult } from '@/types/database'
import { inventarioPayloadSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'

export async function guardarInventarioBoveda(rows: unknown): Promise<ActionResult> {
  const parsed = inventarioPayloadSchema.safeParse(rows)
  if (!parsed.success) {
    const first = parsed.error.flatten().formErrors[0] ?? 'Datos de inventario inválidos.'
    return { ok: false, error: first }
  }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    if (parsed.data.length === 0) return { ok: true }

    const now = new Date().toISOString()
    const withTs = parsed.data.map((r) => ({
      ...r,
      usuario_id: user.id,
      updated_at: now,
    }))

    const { error } = await supabase.from('inventario').upsert(withTs, {
      onConflict: 'usuario_id,divisa,denominacion',
    })

    if (error) {
      logServerError('guardarInventarioBoveda', new Error(error.message))
      return { ok: false, error: 'No se pudo guardar el inventario.' }
    }

    revalidatePath('/inventory')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('guardarInventarioBoveda', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
