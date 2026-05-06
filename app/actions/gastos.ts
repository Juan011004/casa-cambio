'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { gastoInsertSchema, uuidSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'
import { recomputeBalancesDesde } from '@/app/actions/balanceDiario'

const eliminarGastoSchema = z.object({ id: uuidSchema })

export async function registrarGasto(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = gastoInsertSchema.safeParse(raw)
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

    const fechaTs = parsed.data.fecha ? `${parsed.data.fecha}T12:00:00Z` : null
    const { data, error } = await supabase
      .from('gastos')
      .insert({
        usuario_id: user.id,
        concepto: parsed.data.concepto,
        monto_cop: parsed.data.monto_cop,
        ...(fechaTs ? { fecha: fechaTs } : null),
      })
      .select('id')
      .single()

    if (error) {
      logServerError('registrarGasto', new Error(error.message))
      return { ok: false, error: 'No se pudo guardar el gasto.' }
    }
    const row = data as { id: string } | null
    if (!row?.id) return { ok: false, error: 'No se guardó.' }

    if (parsed.data.fecha) {
      const rec = await recomputeBalancesDesde({ fecha: parsed.data.fecha })
      if (!rec.ok) return { ok: false, error: rec.error }
    }

    revalidatePath('/gastos')
    revalidatePath('/dashboard')
    return { ok: true, data: { id: row.id } }
  } catch (e) {
    logServerError('registrarGasto', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

export async function eliminarGasto(raw: unknown): Promise<ActionResult> {
  const parsed = eliminarGastoSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Identificador inválido.' }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { data: prev, error: selErr } = await supabase
      .from('gastos')
      .select('fecha')
      .eq('id', parsed.data.id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (selErr || !prev) {
      logServerError('eliminarGasto/select', selErr ?? new Error('sin fila'))
      return { ok: false, error: 'No se encontró el gasto.' }
    }

    const { error } = await supabase.from('gastos').delete().eq('id', parsed.data.id).eq('usuario_id', user.id)

    if (error) {
      logServerError('eliminarGasto', new Error(error.message))
      return { ok: false, error: 'No se pudo eliminar.' }
    }

    const fechaIso = String((prev as { fecha: string }).fecha).slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) {
      const rec = await recomputeBalancesDesde({ fecha: fechaIso })
      if (!rec.ok) return { ok: false, error: rec.error }
    }

    revalidatePath('/gastos')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('eliminarGasto', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
