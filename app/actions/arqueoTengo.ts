'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { ActionResult } from '@/types/database'
import { arqueoTengoUpsertSchema, uuidSchema } from '@/lib/validation/schemas'
import { z } from 'zod'
import { logServerError } from '@/lib/server/server-log'

const eliminarArqueoSchema = z.object({ id: uuidSchema })

export async function upsertArqueoTengo(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = arqueoTengoUpsertSchema.safeParse(raw)
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

    const { id, moneda_codigo, moneda_nombre, cantidad, precio_compra, fecha } = parsed.data
    const fechaIso = fecha ?? new Date().toISOString().slice(0, 10)

    if (id) {
      const { data: updated, error } = await supabase
        .from('arqueo_tengo')
        .update({
          moneda_codigo,
          moneda_nombre,
          cantidad,
          precio_compra,
          fecha: fechaIso,
        })
        .eq('id', id)
        .eq('usuario_id', user.id)
        .select('id')
        .maybeSingle()

      if (error) {
        logServerError('upsertArqueoTengo/update', new Error(error.message))
        return { ok: false, error: 'No se pudo actualizar el arqueo.' }
      }
      const row = updated as { id: string } | null
      if (!row?.id) return { ok: false, error: 'Registro no encontrado.' }
      revalidatePath('/tengo')
      revalidatePath('/dashboard')
      return { ok: true, data: { id: row.id } }
    }

    const rowInsert = {
      usuario_id: user.id,
      moneda_codigo,
      moneda_nombre,
      cantidad,
      precio_compra,
      fecha: fechaIso,
    }

    const { data: inserted, error } = await supabase
      .from('arqueo_tengo')
      .upsert(rowInsert, { onConflict: 'usuario_id,moneda_codigo' })
      .select('id')
      .single()

    if (error) {
      logServerError('upsertArqueoTengo/upsert', new Error(error.message))
      return {
        ok: false,
        error: 'No se guardó el arqueo. Ejecute `supabase/tengo_arqueo_activos_limpia.sql` si falta la tabla.',
      }
    }
    const row = inserted as { id: string } | null
    if (!row?.id) return { ok: false, error: 'No se guardó.' }

    revalidatePath('/tengo')
    revalidatePath('/dashboard')
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    logServerError('upsertArqueoTengo', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

export async function eliminarArqueoTengo(raw: unknown): Promise<ActionResult> {
  const parsed = eliminarArqueoSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Identificador inválido.' }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { error } = await supabase
      .from('arqueo_tengo')
      .delete()
      .eq('id', parsed.data.id)
      .eq('usuario_id', user.id)

    if (error) {
      logServerError('eliminarArqueoTengo', new Error(error.message))
      return { ok: false, error: 'No se pudo eliminar.' }
    }

    revalidatePath('/tengo')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('eliminarArqueoTengo', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
