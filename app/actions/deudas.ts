'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'
import type { ActionResult } from '@/types/database'
import { abonarDeudaSchema, deudaRegistroSchema, uuidSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'
import { recomputeBalancesDesde } from '@/app/actions/balanceDiario'

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
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { data, error } = await supabase
      .from('deudas')
      .insert({
        usuario_id: user.id,
        tipo: parsed.data.tipo,
        responsable: parsed.data.responsable,
        divisa: parsed.data.divisa,
        monto: parsed.data.monto,
        estado: 'PENDIENTE',
        ...(parsed.data.fecha ? { fecha: parsed.data.fecha } : null),
      })
      .select('id')
      .single()

    if (error) {
      logServerError('registrarDeuda', new Error(error.message))
      return { ok: false, error: 'No se pudo guardar.' }
    }
    const row = data as { id: string } | null
    if (!row?.id) return { ok: false, error: 'No se guardó el registro.' }

    if (parsed.data.fecha) {
      const rec = await recomputeBalancesDesde({ fecha: parsed.data.fecha })
      if (!rec.ok) return { ok: false, error: rec.error }
    }

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

/** Abono parcial o total; registra fila en `pagos_deudas` y reduce `deudas.monto`. */
export async function abonarDeuda(raw: unknown): Promise<ActionResult> {
  const parsed = abonarDeudaSchema.safeParse(raw)
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

    const { id, monto_abono } = parsed.data

    const { data: row, error: selErr } = await supabase
      .from('deudas')
      .select('id,monto,estado')
      .eq('id', id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (selErr || !row) {
      logServerError('abonarDeuda/select', selErr ?? new Error('sin fila'))
      return { ok: false, error: 'No se encontró la deuda.' }
    }

    const pendiente = Number(row.monto)
    if (row.estado !== 'PENDIENTE') return { ok: false, error: 'La deuda no está pendiente.' }
    if (monto_abono > pendiente + 1e-9) return { ok: false, error: 'El abono supera el saldo pendiente.' }

    const restante = Math.max(0, pendiente - monto_abono)
    const saldada = restante < 1e-9

    const { error: payErr } = await supabase.from('pagos_deudas').insert({
      usuario_id: user.id,
      deuda_id: id,
      monto_pagado: monto_abono,
    })

    if (payErr) {
      logServerError('abonarDeuda/pagos_deudas', new Error(payErr.message))
      return {
        ok: false,
        error:
          'No se registró el abono. Ejecute `activos_pagos_balance.sql` en Supabase si falta la tabla `pagos_deudas`.',
      }
    }

    const { error: updErr } = await supabase
      .from('deudas')
      .update({
        monto: saldada ? 0 : restante,
        estado: saldada ? 'SALDADO' : 'PENDIENTE',
      })
      .eq('id', id)
      .eq('usuario_id', user.id)

    if (updErr) {
      logServerError('abonarDeuda/update', new Error(updErr.message))
      return { ok: false, error: 'Abono registrado pero falló actualizar el saldo.' }
    }

    revalidatePath('/dashboard')
    revalidatePath('/nos-deben')
    revalidatePath('/debemos')
    revalidatePath('/inventory')
    revalidatePath('/caja')
    return { ok: true }
  } catch (e) {
    logServerError('abonarDeuda', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

/** Saldar todo en un paso (equivale a abonar el saldo completo). */
export async function saldarDeuda(raw: unknown): Promise<ActionResult> {
  const parsed = saldarSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'Identificador inválido.' }

  try {
    const supabase = createServerActionClient({ cookies })
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const { data: row, error: selErr } = await supabase
      .from('deudas')
      .select('monto')
      .eq('id', parsed.data.id)
      .eq('usuario_id', user.id)
      .maybeSingle()

    if (selErr || !row) return { ok: false, error: 'No se encontró la deuda.' }
    const m = Number(row.monto)
    if (!Number.isFinite(m) || m <= 0) return { ok: false, error: 'Sin saldo pendiente.' }

    return abonarDeuda({ id: parsed.data.id, monto_abono: m })
  } catch (e) {
    logServerError('saldarDeuda', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
