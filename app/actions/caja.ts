'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { ActionResult } from '@/types/database'
import type { Transaccion } from '@/types/database'
import { cajaGuardarSchema, finalizarCierreSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'
import { addDaysYYYYMMDD, dayBoundsLocal } from '@/lib/utils'
import {
  agregarCompraVentaPorMoneda,
  cierreEstimadoOperativo,
  costoPromedioPonderadoVenta,
  gananciaNetaCopVenta,
  sumDeudaDiaPorMoneda,
  type DeudaDiaLite,
} from '@/lib/cierreAuditoria'
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

/**
 * Guarda cierre manual en caja_diaria y alinea inventario.cantidad_actual al conteo físico.
 */
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

    const { fecha, manualCierre } = parsed.data
    const { desde, hastaExclusive } = dayBoundsLocal(fecha)
    const fechaAyer = addDaysYYYYMMDD(fecha, -1)

    const [txRes, deudaRes, cajaDiaRes, cierresAyerRes] = await Promise.all([
      supabase
        .from('transacciones')
        .select('*')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase
        .from('deudas')
        .select('tipo,divisa,monto')
        .eq('usuario_id', user.id)
        .gte('fecha', desde)
        .lt('fecha', hastaExclusive),
      supabase.from('caja_diaria').select('tipo,moneda,monto').eq('usuario_id', user.id).eq('fecha', fecha),
      supabase.from('cierres_diarios').select('*').eq('usuario_id', user.id).eq('fecha', fechaAyer),
    ])

    if (txRes.error) {
      logServerError('finalizarCierreCaja/tx', new Error(txRes.error.message))
      return { ok: false, error: 'No se pudieron leer las transacciones del día.' }
    }
    if (deudaRes.error) {
      logServerError('finalizarCierreCaja/deudas', new Error(deudaRes.error.message))
      return { ok: false, error: 'No se pudieron leer las deudas del día.' }
    }
    if (cajaDiaRes.error) {
      logServerError('finalizarCierreCaja/cajaDia', new Error(cajaDiaRes.error.message))
      return { ok: false, error: 'No se pudo leer la caja del día.' }
    }
    if (cierresAyerRes.error) {
      logServerError('finalizarCierreCaja/cierresAyer', new Error(cierresAyerRes.error.message))
    }

    const txs = (txRes.data ?? []) as Transaccion[]
    const debtRows = (deudaRes.data ?? []) as DeudaDiaLite[]
    const aperturaCajaMap = mapAperturaCaja((cajaDiaRes.data ?? []) as { tipo: string; moneda: string; monto: number }[])

    const ayerPorMoneda = new Map<string, { cierre_manual_fisico: number; promedio_compra_dia: number }>()
    for (const row of (cierresAyerRes.error ? [] : cierresAyerRes.data) ?? []) {
      const r = row as Record<string, unknown>
      const mon = String(r.moneda ?? '').toUpperCase()
      if (!mon) continue
      ayerPorMoneda.set(mon, {
        cierre_manual_fisico: Number(r.cierre_manual_fisico),
        promedio_compra_dia: Number(r.promedio_compra_dia),
      })
    }

    const manualEntries = Object.entries(manualCierre).filter(([, m]) => Number.isFinite(m))
    const auditoriaRows: CierreInsert[] = []

    for (const [monedaRaw, cierreManualFisico] of manualEntries) {
      const moneda = monedaRaw.toUpperCase()
      const ayer = ayerPorMoneda.get(moneda)
      const debenDia = sumDeudaDiaPorMoneda(debtRows, moneda, 'DEBEN')
      const deboDia = sumDeudaDiaPorMoneda(debtRows, moneda, 'DEBO')
      const aperturaOperativa = aperturaCajaMap[moneda] ?? 0

      const montoInicial =
        ayer != null && Number.isFinite(ayer.cierre_manual_fisico)
          ? ayer.cierre_manual_fisico
          : aperturaOperativa
      const promedioInicial =
        ayer != null && Number.isFinite(ayer.promedio_compra_dia) ? ayer.promedio_compra_dia : 0

      const {
        totalCompraMonto,
        costoCompraCop,
        promedioCompraDia,
        totalVentaMonto,
        promedioVentaDia,
      } = agregarCompraVentaPorMoneda(txs, moneda)
      const cierreEstimadoSistema = cierreEstimadoOperativo({
        aperturaCaja: aperturaOperativa,
        compras: totalCompraMonto,
        ventas: totalVentaMonto,
        debenDia,
        deboDia,
      })

      const costoUnitarioWac = costoPromedioPonderadoVenta({
        montoInicial,
        promedioInicial,
        totalCompraMonto,
        costoCompraCop,
        promedioCompraDia,
      })
      const gananciaNetaCop = gananciaNetaCopVenta({
        totalVentaMonto,
        promedioVentaDia,
        costoUnitarioWac: costoUnitarioWac,
      })

      const diferenciaArqueo = cierreManualFisico - cierreEstimadoSistema

      auditoriaRows.push({
        usuario_id: user.id,
        fecha,
        moneda,
        monto_inicial: montoInicial,
        promedio_inicial: promedioInicial,
        total_compra_monto: totalCompraMonto,
        promedio_compra_dia: promedioCompraDia,
        total_venta_monto: totalVentaMonto,
        promedio_venta_dia: promedioVentaDia,
        cierre_estimado_sistema: cierreEstimadoSistema,
        cierre_manual_fisico: cierreManualFisico,
        diferencia_arqueo: diferenciaArqueo,
        ganancia_neta_cop: gananciaNetaCop,
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
        return { ok: false, error: 'No se pudo actualizar la auditoría de cierres.' }
      }
      const { error: insAud } = await supabase.from('cierres_diarios').insert(auditoriaRows)
      if (insAud) {
        logServerError('finalizarCierreCaja/auditoria', new Error(insAud.message))
        return { ok: false, error: 'Cierre guardado pero falló la auditoría (cierres_diarios). Ejecute el SQL de la tabla si aún no existe.' }
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
