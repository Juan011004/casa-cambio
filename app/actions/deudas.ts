'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { deudaRegistroSchema, uuidSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'

const saldarSchema = z.object({ id: uuidSchema })

export async function registrarDeuda(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deudaRegistroSchema.safeParse(raw)
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
    if (userErr || !user) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { data, error } = await supabase
      .from('deudas')
      .insert({
        usuario_id: user.id,
        tipo: parsed.data.tipo,
        responsable: parsed.data.responsable,
        divisa: parsed.data.divisa,
        monto: parsed.data.monto,
        estado: 'PENDIENTE',
      })
      .select('id')
      .single()

    if (error) {
      logServerError('registrarDeuda', new Error(error.message))
      return { ok: false, error: 'No se pudo guardar.' }
    }
    const row = data as { id: string } | null
    if (!row?.id) return { ok: false, error: 'No se guardó el registro.' }

    revalidatePath('/dashboard')
    revalidatePath('/nos-deben')
    revalidatePath('/debemos')
    revalidatePath('/inventory')
    revalidatePath('/caja')
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    logServerError('registrarDeuda', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

export async function saldarDeuda(raw: unknown): Promise<ActionResult> {
  const parsed = saldarSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Identificador inválido.' }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { error } = await supabase
      .from('deudas')
      .update({ estado: 'SALDADO' })
      .eq('id', parsed.data.id)
      .eq('usuario_id', user.id)
      .eq('estado', 'PENDIENTE')

    if (error) {
      logServerError('saldarDeuda', new Error(error.message))
      return { ok: false, error: 'No se pudo actualizar.' }
    }

    revalidatePath('/dashboard')
    revalidatePath('/nos-deben')
    revalidatePath('/debemos')
    return { ok: true }
  } catch (e) {
    logServerError('saldarDeuda', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
