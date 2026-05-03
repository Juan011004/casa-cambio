'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { totalCopFromTasa } from '@/lib/pricing'
import type { ActionResult, MetodoPago } from '@/types/database'
import { transaccionCompraVentaSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'

async function serverClient() {
  return createServerActionClient({ cookies })
}

async function ultimoPrecioCompraPorMoneda(
  supabase: Awaited<ReturnType<typeof serverClient>>,
  userId: string,
  moneda: string
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('transacciones')
      .select('tasa_aplicada')
      .eq('usuario_id', userId)
      .eq('tipo', 'COMPRA')
      .eq('moneda', moneda)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    const n = Number((data as { tasa_aplicada: number }).tasa_aplicada)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch (e) {
    logServerError('ultimoPrecioCompraPorMoneda', e)
    return null
  }
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
    const { divisa, cantidad, tasa, metodo_pago } = parsed.data
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
      ganancia_cop: 0,
    })

    if (error) {
      logServerError('registrarCompra', new Error(error.message))
      return { ok: false, error: 'No se pudo registrar la compra.' }
    }

    revalidatePath('/dashboard')
    revalidatePath('/comprar')
    revalidatePath('/historial')
    revalidatePath('/gastos')
    revalidatePath('/caja')
    return { ok: true, data: { total_cop, tasa: tasaEfectiva } }
  } catch (e) {
    logServerError('registrarCompra', e)
    return { ok: false, error: 'Error inesperado al registrar.' }
  }
}

export async function registrarVenta(
  raw: unknown
): Promise<ActionResult<{ total_cop: number; tasa: number; ganancia_cop: number }>> {
  const parsed = transaccionCompraVentaSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors
    const first = Object.values(msg).flat()[0] ?? 'Datos inválidos.'
    return { ok: false, error: first }
  }

  try {
    const { divisa, cantidad, tasa, metodo_pago } = parsed.data
    const supabase = await serverClient()

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user?.id) return { ok: false, error: 'Sesión no válida.', code: 'AUTH' }

    const tasaEfectiva = tasa
    const total_cop = totalCopFromTasa(cantidad, tasaEfectiva)
    if (total_cop <= 0) return { ok: false, error: 'Monto COP inválido.' }

    const precioCompraRef = await ultimoPrecioCompraPorMoneda(supabase, user.id, divisa)
    let ganancia_cop = 0
    if (precioCompraRef != null) {
      ganancia_cop = Math.round((tasaEfectiva - precioCompraRef) * cantidad * 100) / 100
    }

    const { error } = await supabase.from('transacciones').insert({
      tipo: 'VENTA',
      moneda: divisa,
      monto_divisa: cantidad,
      tasa_aplicada: tasaEfectiva,
      total_cop,
      usuario_id: user.id,
      metodo_pago: metodo_pago as MetodoPago,
      ganancia_cop,
    })

    if (error) {
      logServerError('registrarVenta', new Error(error.message))
      return { ok: false, error: 'No se pudo registrar la venta.' }
    }

    revalidatePath('/dashboard')
    revalidatePath('/vender')
    revalidatePath('/historial')
    revalidatePath('/inventory')
    revalidatePath('/caja')
    return { ok: true, data: { total_cop, tasa: tasaEfectiva, ganancia_cop } }
  } catch (e) {
    logServerError('registrarVenta', e)
    return { ok: false, error: 'Error inesperado al registrar.' }
  }
}
