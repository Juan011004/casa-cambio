import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/database'
import type { Transaccion } from '@/types/database'
import type { CopPorUnidad } from '@/lib/trm'
import { dayBoundsLocal } from '@/lib/utils'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'
import { gananciaListaDesdeAuditoria, type AuditoriaOverrideVals } from '@/lib/auditoriaVivo'
import { montoDivisaEnCop, saldoDeudasNetoCop, totalDeudasMontoCop } from '@/lib/balanceCop'
import { formatCOP, formatMilesEs } from '@/lib/formatMoney'
import { q6 } from '@/lib/precision'

function rowsToCopMap(rows: { codigo: string; valor_cop: number }[]): CopPorUnidad {
  const out: CopPorUnidad = {
    USD: 0,
    EUR: 0,
    GBP: 0,
    BRL: 0,
    MXN: 0,
    CAD: 0,
    CLP: 0,
    PEN: 0,
    ARS: 0,
    AUD: 0,
    COP: 1,
    OTRO: 0,
  }
  for (const r of rows) {
    const v = Number(r.valor_cop)
    if (Number.isFinite(v) && v > 0) {
      out[r.codigo as keyof CopPorUnidad] = v as never
    }
  }
  if (!out.OTRO && out.USD) out.OTRO = out.USD
  return out
}

function sumTxMontoDivisa(rows: Transaccion[], tipo: 'COMPRA' | 'VENTA'): { codigo: string; valor: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.tipo !== tipo) continue
    const k = r.moneda
    map.set(k, (map.get(k) ?? 0) + Number(r.monto_divisa))
  }
  return Array.from(map.entries())
    .filter(([, v]) => Math.abs(v) > 1e-10)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, valor]) => ({ codigo, valor }))
}

function sumDeudasPendientes(rows: { divisa: string; monto: number }[]): { codigo: string; valor: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    if (r.divisa === 'COP') continue
    m.set(r.divisa, (m.get(r.divisa) ?? 0) + r.monto)
  }
  return Array.from(m.entries())
    .filter(([, v]) => Math.abs(v) > 1e-10)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, valor]) => ({ codigo, valor }))
}

function latestDeudasByKey(rows: { id: string; responsable: string; divisa: string; monto: number; fecha: string }[]) {
  const latest = new Map<string, { id: string; responsable: string; divisa: string; monto: number; fecha: string }>()
  // `rows` debe venir en orden fecha desc
  for (const r of rows) {
    const key = `${r.responsable}||${r.divisa}`
    if (latest.has(key)) continue
    latest.set(key, r)
  }
  return Array.from(latest.values()).filter((x) => Number(x.monto) > 1e-12)
}

/**
 * Calcula fila para `balances_diarios` (UPSERT) en la fecha local `fecha` (YYYY-MM-DD).
 */
export async function computeBalanceDiarioUpsert(
  supabase: SupabaseClient<Database>,
  userId: string,
  fecha: string
): Promise<Database['public']['Tables']['balances_diarios']['Insert']> {
  const { desde, hastaExclusive } = dayBoundsLocal(fecha)

  const monthKey = String(fecha).slice(0, 7) // YYYY-MM

  const [
    trmRes,
    prevBalRes,
    txRes,
    debenRes,
    deboRes,
    cajaCierreRes,
    cajaPrecioRes,
    gastRes,
    cPrevRes,
    invRes,
    ovRes,
  ] = await Promise.all([
    supabase.from('trm_mercado').select('codigo,valor_cop'),
    supabase
      .from('balances_diarios')
      .select('fecha,debo_tener_total')
      .eq('usuario_id', userId)
      .lt('fecha', fecha)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('transacciones')
      .select('*')
      .eq('usuario_id', userId)
      .gte('fecha', desde)
      .lt('fecha', hastaExclusive),
    supabase
      .from('deudas')
      .select('id,responsable,divisa,monto,fecha')
      .eq('usuario_id', userId)
      .eq('tipo', 'DEBEN')
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })
      .limit(1000),
    supabase
      .from('deudas')
      .select('id,responsable,divisa,monto,fecha')
      .eq('usuario_id', userId)
      .eq('tipo', 'DEBO')
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })
      .limit(1000),
    supabase.from('caja_diaria').select('moneda,monto').eq('usuario_id', userId).eq('fecha', fecha).eq('tipo', 'CIERRE'),
    supabase.from('caja_precios').select('moneda,precio_compra').eq('usuario_id', userId).eq('fecha', fecha),
    supabase
      .from('gastos')
      .select('monto_cop')
      .eq('usuario_id', userId)
      .gte('fecha', desde)
      .lt('fecha', hastaExclusive),
    supabase
      .from('cierres_diarios')
      .select('moneda,fecha,cierre_manual,promedio_compra,promedio_compra_acumulado,id,created_at')
      .eq('usuario_id', userId)
      .lt('fecha', fecha),
    supabase.from('inventario').select('divisa,cantidad_actual').eq('usuario_id', userId),
    supabase
      .from('auditoria_overrides')
      .select('moneda,cantidad_inicial,promedio_anterior,promedio_compra_hoy,ganancia_cop')
      .eq('usuario_id', userId)
      .eq('fecha', fecha),
  ])

  const copMap = rowsToCopMap((trmRes.data ?? []) as { codigo: string; valor_cop: number }[])

  const debenRaw = (debenRes.data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id ?? ''),
      responsable: String(row.responsable ?? ''),
      divisa: String(row.divisa ?? ''),
      monto: Number(row.monto ?? 0),
      fecha: String(row.fecha ?? ''),
    }
  })
  const deboRaw = (deboRes.data ?? []).map((r) => {
    const row = r as Record<string, unknown>
    return {
      id: String(row.id ?? ''),
      responsable: String(row.responsable ?? ''),
      divisa: String(row.divisa ?? ''),
      monto: Number(row.monto ?? 0),
      fecha: String(row.fecha ?? ''),
    }
  })

  const debenLatest = latestDeudasByKey(debenRaw)
  const deboLatest = latestDeudasByKey(deboRaw)

  const debenRows = debenLatest.map((r) => ({ divisa: r.divisa, monto: r.monto }))
  const deboRows = deboLatest.map((r) => ({ divisa: r.divisa, monto: r.monto }))

  const cierreRows = (cajaCierreRes.error ? [] : cajaCierreRes.data ?? []) as { moneda: string; monto: number }[]
  const precioRows = (cajaPrecioRes.error ? [] : cajaPrecioRes.data ?? []) as { moneda: string; precio_compra: number }[]
  const precioMap = new Map<string, number>()
  for (const r of precioRows) precioMap.set(String(r.moneda).toUpperCase(), Number(r.precio_compra))

  const sumCajaCop = cierreRows.reduce((s, r) => {
    const mon = String(r.moneda).toUpperCase()
    const cant = Number(r.monto)
    const pc = Number(precioMap.get(mon) ?? 0)
    if (!Number.isFinite(cant) || !Number.isFinite(pc)) return s
    return q6(s + q6(cant * pc))
  }, 0)

  const gastosDiaCop =
    gastRes.error || !gastRes.data
      ? 0
      : gastRes.data.reduce((s, r) => s + Number((r as { monto_cop: number }).monto_cop ?? 0), 0)

  const txs = (txRes.data ?? []) as Transaccion[]
  const ultimoCierrePorMoneda = saldoPromedioPorMonedaDesdeCierres(
    (cPrevRes.error ? [] : cPrevRes.data) as CierreRowParaArrastre[]
  )

  const invForAudit = (invRes.error ? [] : invRes.data ?? []).map((r) => ({
    divisa: String((r as { divisa?: string }).divisa ?? '').toUpperCase(),
  }))

  const ovMap = new Map<string, AuditoriaOverrideVals>()
  for (const r of ovRes.error ? [] : ovRes.data ?? []) {
    const row = r as Record<string, unknown>
    const mon = String(row.moneda ?? '').toUpperCase()
    if (!mon) continue
    ovMap.set(mon, {
      cantidad_inicial: row.cantidad_inicial != null ? Number(row.cantidad_inicial) : null,
      promedio_anterior: row.promedio_anterior != null ? Number(row.promedio_anterior) : null,
      promedio_compra_hoy: row.promedio_compra_hoy != null ? Number(row.promedio_compra_hoy) : null,
      ganancia_cop: row.ganancia_cop != null ? Number(row.ganancia_cop) : null,
    })
  }

  const gananciaLista = gananciaListaDesdeAuditoria(txs, invForAudit, ultimoCierrePorMoneda, ovMap)
  const gananciasDia = gananciaLista.reduce((s, x) => s + x.valor, 0)

  const comprasLista = sumTxMontoDivisa(txs, 'COMPRA')
  const ventasLista = sumTxMontoDivisa(txs, 'VENTA')
  const nosDebenLista = sumDeudasPendientes(debenRows)
  const debemosLista = sumDeudasPendientes(deboRows)

  const tengoCop = q6(sumCajaCop + saldoDeudasNetoCop(debenRows, deboRows, copMap))
  const meDebenCop = totalDeudasMontoCop(debenRows, copMap)
  const deboCop = totalDeudasMontoCop(deboRows, copMap)

  const prevDebo = prevBalRes.data?.debo_tener_total
  const prevFecha = prevBalRes.data?.fecha ? String((prevBalRes.data as any).fecha).slice(0, 10) : null
  const prevMonthKey = prevFecha ? prevFecha.slice(0, 7) : null
  let deboTenerCop: number
  // Regla: primera operación del mes => Debo tener = Tengo (no arrastra ganancias/gastos).
  if (!prevFecha || prevMonthKey !== monthKey) {
    deboTenerCop = tengoCop
  } else if (prevDebo != null && Number.isFinite(Number(prevDebo))) {
    deboTenerCop = Number(prevDebo) + gananciasDia - gastosDiaCop
  } else {
    deboTenerCop = tengoCop + gananciasDia - gastosDiaCop
  }

  const detalle_arqueo: Json =
    cierreRows.map((r) => {
      const mon = String(r.moneda).toUpperCase()
      const cant = Number(r.monto)
      const pc = Number(precioMap.get(mon) ?? 0)
      const valorCop = q6(cant * pc)
      return {
        moneda_codigo: mon,
        moneda_nombre: mon,
        cantidad: cant,
        precio_compra: pc,
        valor_cop: valorCop,
        valor_cop_fmt: formatCOP(valorCop),
        cantidad_fmt: formatMilesEs(cant, 4),
        precio_compra_fmt: formatMilesEs(pc, 4),
      }
    }) ?? []

  const mapFilaDeuda = (r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    responsable: String(r.responsable ?? ''),
    divisa: String(r.divisa ?? ''),
    monto: Number(r.monto ?? 0),
    fecha: String(r.fecha ?? ''),
  })

  const detalle_deudas: Json = {
    /** Filas tal cual al momento del snapshot (para pantalla histórica). */
    filas_deben: (debenLatest as unknown as Record<string, unknown>[]).map(mapFilaDeuda),
    filas_debo: (deboLatest as unknown as Record<string, unknown>[]).map(mapFilaDeuda),
    deben: nosDebenLista.map((x) => ({
      codigo: x.codigo,
      valor_divisa: x.valor,
      valor_divisa_fmt: formatMilesEs(x.valor, 4),
      cop_fmt: formatCOP(montoDivisaEnCop(x.valor, x.codigo, copMap)),
    })),
    debo: debemosLista.map((x) => ({
      codigo: x.codigo,
      valor_divisa: x.valor,
      valor_divisa_fmt: formatMilesEs(x.valor, 4),
      cop_fmt: formatCOP(montoDivisaEnCop(x.valor, x.codigo, copMap)),
    })),
    me_deben_total_fmt: formatCOP(meDebenCop),
    debo_total_fmt: formatCOP(deboCop),
  }

  const detalle_tarjetas: Json = {
    compras: comprasLista.map((x) => ({
      codigo: x.codigo,
      valor: x.valor,
      valor_fmt: formatMilesEs(x.valor, 4),
    })),
    ventas: ventasLista.map((x) => ({
      codigo: x.codigo,
      valor: x.valor,
      valor_fmt: formatMilesEs(x.valor, 4),
    })),
    ganancia: gananciaLista.map((x) => ({
      codigo: x.codigo,
      valor_cop: x.valor,
      valor_cop_fmt: formatCOP(x.valor),
    })),
    ganancia_dia_total_fmt: formatCOP(gananciasDia),
    gastos_dia_fmt: formatCOP(gastosDiaCop),
    caja_total_cop_fmt: formatCOP(sumCajaCop),
    tengo_total_fmt: formatCOP(tengoCop),
    debo_tener_total_fmt: formatCOP(deboTenerCop),
  }

  return {
    usuario_id: userId,
    fecha,
    caja_total_cop: sumCajaCop,
    tengo_total: tengoCop,
    debo_tener_total: deboTenerCop,
    ganancias_dia: gananciasDia,
    gastos_dia: gastosDiaCop,
    me_deben_total: meDebenCop,
    debo_total: deboCop,
    detalle_arqueo,
    detalle_deudas,
    detalle_tarjetas,
  }
}
