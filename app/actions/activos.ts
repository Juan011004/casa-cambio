'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { ActionResult } from '@/types/database'
import { z } from 'zod'
import { actualizarActivoSchema, crearActivoSchema, uuidSchema } from '@/lib/validation/schemas'

const eliminarActivoSchema = z.object({ id: uuidSchema })
import { logServerError } from '@/lib/server/server-log'

export async function crearActivo(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = crearActivoSchema.safeParse(raw)
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

    const { concepto, valor_cop, fecha } = parsed.data
    const { data, error } = await supabase
      .from('activos')
      .insert({
        usuario_id: user.id,
        concepto,
        valor_cop,
        fecha: fecha ?? new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single()

    if (error) {
      logServerError('crearActivo', new Error(error.message))
      return {
        ok: false,
        error: 'No se guardó. Ejecute `activos_pagos_balance.sql` en Supabase si la tabla no existe.',
      }
    }
    const row = data as { id: string } | null
    if (!row?.id) return { ok: false, error: 'No se guardó.' }

    revalidatePath('/tengo')
    revalidatePath('/dashboard')
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    logServerError('crearActivo', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

export async function eliminarActivo(raw: unknown): Promise<ActionResult> {
  const parsed = eliminarActivoSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Identificador inválido.' }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { error } = await supabase.from('activos').delete().eq('id', parsed.data.id).eq('usuario_id', user.id)

    if (error) {
      logServerError('eliminarActivo', new Error(error.message))
      return { ok: false, error: 'No se pudo eliminar.' }
    }

    revalidatePath('/tengo')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('eliminarActivo', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

export async function actualizarActivo(raw: unknown): Promise<ActionResult> {
  const parsed = actualizarActivoSchema.safeParse(raw)
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

    const { id, concepto, valor_cop } = parsed.data
    const { error } = await supabase
      .from('activos')
      .update({ concepto, valor_cop })
      .eq('id', id)
      .eq('usuario_id', user.id)

    if (error) {
      logServerError('actualizarActivo', new Error(error.message))
      return { ok: false, error: 'No se pudo actualizar.' }
    }

    revalidatePath('/tengo')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('actualizarActivo', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
