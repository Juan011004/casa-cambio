'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { ActionResult, Transaccion } from '@/types/database'
import { cajaGuardarSchema, finalizarCierreSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'
import { dayBoundsLocal } from '@/lib/utils'
import { agregarCompraVentaPorMoneda, cierreEstimadoSimple, gananciaDiaPonderadaCop } from '@/lib/cierreAuditoria'
import type { Database } from '@/database'

type CierreInsert = Database['public']['Tables']['cierres_diarios']['Insert']

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
      revalidatePath('/inventory')
      return { ok: true }
    }

    const { error: insErr } = await supabase.from('caja_diaria').insert(rows)
    if (insErr) {
      logServerError('guardarCajaDiaria/insert', new Error(insErr.message))
      return { ok: false, error: 'No se pudo guardar la caja.' }
    }

    revalidatePath('/caja')
    revalidatePath('/dashboard')
    revalidatePath('/inventory')
    return { ok: true }
  } catch (e) {
    logServerError('guardarCajaDiaria', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}

function mapAperturaCaja(rows: { tipo: string; moneda: string; monto: number }[]): Record<string, number> {
  const ap: Record<string, number> = {}
  for (const r of rows) {
    if (r.tipo === 'APERTURA') ap[r.moneda.toUpperCase()] = Number(r.monto)
  }
  return ap
}

/** Guarda cierre manual, filas en `cierres_diarios` e inventario al conteo físico. */
export async function finalizarCierreCaja(raw: unknown): Promise<ActionResult> {
  const parsed = finalizarCierreSchema.safeParse(raw)
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

    const { fecha, manualCierre, aperturas } = parsed.data
    const { desde, hastaExclusive } = dayBoundsLocal(fecha)

    const [txRes, cajaDiaRes] = await Promise.all([
      supabase
        .from('transacciones')
        .select('*')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase.from('caja_diaria').select('tipo,moneda,monto').eq('usuario_id', user.id).eq('fecha', fecha),
    ])

    if (txRes.error) {
      logServerError('finalizarCierreCaja/tx', new Error(txRes.error.message))
      return { ok: false, error: 'No se pudieron leer las transacciones del día.' }
    }
    if (cajaDiaRes.error) {
      logServerError('finalizarCierreCaja/cajaDia', new Error(cajaDiaRes.error.message))
      return { ok: false, error: 'No se pudo leer la caja del día.' }
    }

    const txs = (txRes.data ?? []) as Transaccion[]
    const aperturaCajaMap = mapAperturaCaja((cajaDiaRes.data ?? []) as { tipo: string; moneda: string; monto: number }[])

    const manualEntries = Object.entries(manualCierre).filter(([, m]) => Number.isFinite(m))
    const auditoriaRows: CierreInsert[] = []

    for (const [monedaRaw, cierreManual] of manualEntries) {
      const moneda = monedaRaw.toUpperCase()
      const aperturaSnap = aperturas?.[moneda] ?? aperturaCajaMap[moneda] ?? 0
      const { totalCompraMonto, totalVentaMonto } = agregarCompraVentaPorMoneda(txs, moneda)
      const cierreEstimado = cierreEstimadoSimple(aperturaSnap, totalCompraMonto, totalVentaMonto)
      const gananciaCalculada = gananciaDiaPonderadaCop(txs, moneda)

      auditoriaRows.push({
        usuario_id: user.id,
        fecha,
        moneda,
        apertura: aperturaSnap,
        cierre_manual: cierreManual,
        cierre_estimado: cierreEstimado,
        ganancia_calculada: gananciaCalculada,
      })
    }

    const { error: delErr } = await supabase
      .from('caja_diaria')
      .delete()
      .eq('usuario_id', user.id)
      .eq('fecha', fecha)
      .eq('tipo', 'CIERRE')

    if (delErr) {
      logServerError('finalizarCierreCaja/delete', new Error(delErr.message))
      return { ok: false, error: 'No se pudo limpiar el cierre previo.' }
    }

    const cierreRows = manualEntries.map(([moneda, monto]) => ({
      usuario_id: user.id,
      fecha,
      tipo: 'CIERRE' as const,
      moneda: moneda.toUpperCase(),
      monto,
    }))

    if (cierreRows.length > 0) {
      const { error: insCierre } = await supabase.from('caja_diaria').insert(cierreRows)
      if (insCierre) {
        logServerError('finalizarCierreCaja/cierre', new Error(insCierre.message))
        return { ok: false, error: 'No se pudo guardar el cierre.' }
      }
    }

    if (auditoriaRows.length > 0) {
      const { error: delAud } = await supabase
        .from('cierres_diarios')
        .delete()
        .eq('usuario_id', user.id)
        .eq('fecha', fecha)
      if (delAud) {
        logServerError('finalizarCierreCaja/delAud', new Error(delAud.message))
        return { ok: false, error: 'No se pudo actualizar el historial de cierres.' }
      }
      const { error: insAud } = await supabase.from('cierres_diarios').insert(auditoriaRows)
      if (insAud) {
        logServerError('finalizarCierreCaja/cierres', new Error(insAud.message))
        return {
          ok: false,
          error: 'Cierre guardado pero falló el historial. Ejecute el SQL de `cierres_diarios` si aún no existe.',
        }
      }
    }

    const now = new Date().toISOString()
    const invRows = Object.entries(manualCierre)
      .filter(([, m]) => Number.isFinite(m))
      .map(([divisa, cantidad_actual]) => ({
        usuario_id: user.id,
        divisa: divisa.toUpperCase(),
        cantidad_actual,
        ultima_actualizacion: now,
      }))

    if (invRows.length > 0) {
      const { error: invErr } = await supabase.from('inventario').upsert(invRows, {
        onConflict: 'usuario_id,divisa',
      })
      if (invErr) {
        logServerError('finalizarCierreCaja/inventario', new Error(invErr.message))
        return { ok: false, error: 'Cierre guardado pero falló la actualización de inventario.' }
      }
    }

    revalidatePath('/caja')
    revalidatePath('/dashboard')
    revalidatePath('/inventory')
    return { ok: true }
  } catch (e) {
    logServerError('finalizarCierreCaja', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
