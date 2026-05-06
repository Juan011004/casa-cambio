'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { logServerError } from '@/lib/server/server-log'
import { computeBalanceDiarioUpsert } from '@/lib/balanceDiarioCompute'
import { addDaysYYYYMMDD, fechaLocalYYYYMMDD } from '@/lib/utils'

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

/**
 * Recalcula snapshots encadenados desde `fecha` (inclusive) hacia adelante:
 * - siempre recalcula `fecha`
 * - luego recalcula las fechas posteriores que ya existan en `balances_diarios`
 * Esto permite “edición retroactiva” y que la cadena de `debo_tener_total` se ajuste.
 */
export async function recomputeBalancesDesde(raw: unknown): Promise<ActionResult> {
  const parsed = z.object({ fecha: fechaSchema }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Fecha inválida.' }
  const { fecha } = parsed.data

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const fechas: string[] = [fecha]
    const { data } = await supabase
      .from('balances_diarios')
      .select('fecha')
      .eq('usuario_id', user.id)
      .gt('fecha', fecha)
      .order('fecha', { ascending: true })

    for (const r of data ?? []) {
      const f = String((r as { fecha: string }).fecha).slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(f)) fechas.push(f)
    }

    // Dedup por si la fecha ya estaba en la tabla.
    const unique = Array.from(new Set(fechas)).sort((a, b) => a.localeCompare(b))
    for (const f of unique) {
      const row = await computeBalanceDiarioUpsert(supabase, user.id, f)
      const { error } = await supabase.from('balances_diarios').upsert(row, { onConflict: 'usuario_id,fecha' })
      if (error) {
        logServerError('recomputeBalancesDesde/upsert', new Error(error.message))
        return { ok: false, error: 'No se pudo recalcular un snapshot.' }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/gastos')
    revalidatePath('/caja')
    revalidatePath('/nos-deben')
    revalidatePath('/debemos')
    return { ok: true }
  } catch (e) {
    logServerError('recomputeBalancesDesde', e)
    return { ok: false, error: 'Error inesperado al recalcular snapshots.' }
  }
}

/**
 * Auto-cierre (fallback): al abrir la app, si ayer no tiene snapshot, lo crea.
 * No “cierra” transacciones; solo asegura backup contable en `balances_diarios`.
 */
export async function ensureSnapshotAyer(): Promise<ActionResult> {
  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const hoy = fechaLocalYYYYMMDD()
    const ayer = addDaysYYYYMMDD(hoy, -1)

    const { data: exist } = await supabase
      .from('balances_diarios')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('fecha', ayer)
      .maybeSingle()

    if (exist?.id) return { ok: true }

    const row = await computeBalanceDiarioUpsert(supabase, user.id, ayer)
    const { error } = await supabase.from('balances_diarios').upsert(row, { onConflict: 'usuario_id,fecha' })
    if (error) {
      logServerError('ensureSnapshotAyer/upsert', new Error(error.message))
      return { ok: false, error: 'No se pudo crear el snapshot de ayer.' }
    }

    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    logServerError('ensureSnapshotAyer', e)
    return { ok: false, error: 'Error inesperado en auto-cierre.' }
  }
}
