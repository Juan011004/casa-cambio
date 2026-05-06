'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { totalCopFromTasa } from '@/lib/pricing'
import type { ActionResult, MetodoPago } from '@/types/database'
import { transaccionCompraVentaSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'
import { recomputeBalancesDesde } from '@/app/actions/balanceDiario'

async function serverClient() {
  return createServerActionClient({ cookies })
}

export async function registrarCompra(
  raw: unknown
): Promise<ActionResult<{ total_cop: number; tasa: number }>> {
  const parsed = transaccionCompraVentaSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors
    const first = Object.values(msg).flat()[0] ?? 'Datos inválidos.'
    return { ok: false, error: first }
  }

  try {
    const { divisa, cantidad, tasa, metodo_pago, fecha } = parsed.data
    const fechaTs = fecha ? `${fecha}T12:00:00Z` : null
    const supabase = await serverClient()

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const tasaEfectiva = tasa
    const total_cop = totalCopFromTasa(cantidad, tasaEfectiva)
    if (total_cop <= 0) return { ok: false, error: 'Monto COP inválido.' }

    const { error } = await supabase.from('transacciones').insert({
      tipo: 'COMPRA',
      moneda: divisa,
      monto_divisa: cantidad,
      tasa_aplicada: tasaEfectiva,
      total_cop,
      usuario_id: user.id,
      metodo_pago: metodo_pago as MetodoPago,
      ...(fechaTs ? { fecha: fechaTs } : null),
    })

    if (error) {
      logServerError('registrarCompra', new Error(error.message))
      return { ok: false, error: 'No se pudo registrar la compra.' }
    }

    if (fecha) {
      const rec = await recomputeBalancesDesde({ fecha })
      if (!rec.ok) return { ok: false, error: rec.error }
    }

    revalidatePath('/dashboard')
    revalidatePath('/comprar')
    revalidatePath('/historial')
    revalidatePath('/gastos')
    revalidatePath('/caja')
    revalidatePath('/inventory')
    return { ok: true, data: { total_cop, tasa: tasaEfectiva } }
  } catch (e) {
    logServerError('registrarCompra', e)
    return { ok: false, error: 'Error inesperado al registrar.' }
  }
}

export async function registrarVenta(
  raw: unknown
): Promise<ActionResult<{ total_cop: number; tasa: number }>> {
  const parsed = transaccionCompraVentaSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors
    const first = Object.values(msg).flat()[0] ?? 'Datos inválidos.'
    return { ok: false, error: first }
  }

  try {
    const { divisa, cantidad, tasa, metodo_pago, fecha } = parsed.data
    const fechaTs = fecha ? `${fecha}T12:00:00Z` : null
    const supabase = await serverClient()

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const tasaEfectiva = tasa
    const total_cop = totalCopFromTasa(cantidad, tasaEfectiva)
    if (total_cop <= 0) return { ok: false, error: 'Monto COP inválido.' }

    const { error } = await supabase.from('transacciones').insert({
      tipo: 'VENTA',
      moneda: divisa,
      monto_divisa: cantidad,
      tasa_aplicada: tasaEfectiva,
      total_cop,
      usuario_id: user.id,
      metodo_pago: metodo_pago as MetodoPago,
      ...(fechaTs ? { fecha: fechaTs } : null),
    })

    if (error) {
      logServerError('registrarVenta', new Error(error.message))
      return { ok: false, error: 'No se pudo registrar la venta.' }
    }

    if (fecha) {
      const rec = await recomputeBalancesDesde({ fecha })
      if (!rec.ok) return { ok: false, error: rec.error }
    }

    revalidatePath('/dashboard')
    revalidatePath('/vender')
    revalidatePath('/historial')
    revalidatePath('/inventory')
    revalidatePath('/caja')
    return { ok: true, data: { total_cop, tasa: tasaEfectiva } }
  } catch (e) {
    logServerError('registrarVenta', e)
    return { ok: false, error: 'Error inesperado al registrar.' }
  }
}
