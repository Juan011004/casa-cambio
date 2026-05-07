'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Package } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { useFechaOperativa } from '@/components/fecha-operativa/FechaOperativaProvider'
import { dayBoundsLocal, formatCOP, formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { sumGananciaHistoricaHastaFecha, sumGananciaHistoricaTotal } from '@/lib/gananciaCierres'
import { saldoDeudasNetoCop, totalDeudasMontoCop } from '@/lib/balanceCop'
import type { Database } from '@/database'
import { gananciaDiaPonderadaCop } from '@/lib/cierreAuditoria'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'
import { exportAuditoriaVivoExcel } from '@/lib/exportCierresExcel'
import { obtenerTrmMercado } from '@/app/actions/trm'
import { TRM_TICKER_ORDER, type TrmMercadoFila } from '@/lib/trm-ticker'
import { CargaInicialDialog } from '@/components/CargaInicialDialog'
import { filasAuditoriaVivo, monedasParaAuditoria } from '@/lib/auditoriaVivo'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import type { Transaccion } from '@/types/database'
import type { CopPorUnidad } from '@/lib/trm'

type BalanceSnapRow = Database['public']['Tables']['balances_diarios']['Row']

type DetalleTarjetasSnap = {
  compras?: { codigo: string; valor: number }[]
  ventas?: { codigo: string; valor: number }[]
  ganancia?: { codigo: string; valor_cop: number }[]
}

const FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  CAD: '🇨🇦',
  BRL: '🇧🇷',
  MXN: '🇲🇽',
  CLP: '🇨🇱',
  PEN: '🇵🇪',
  ARS: '🇦🇷',
  AUD: '🇦🇺',
}

function textoActualizado(iso: string | null) {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h`
  return `${Math.floor(h / 24)} d`
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

function gananciaListaDesdeTx(
  rows: Transaccion[],
  prevPorMoneda: Map<string, { saldoAnterior: number; promedioAnterior: number }>
): { codigo: string; valor: number }[] {
  const codes = new Set<string>()
  for (const r of rows) codes.add(r.moneda)
  const out: { codigo: string; valor: number }[] = []
  for (const codigo of Array.from(codes).sort()) {
    const p = prevPorMoneda.get(codigo) ?? { saldoAnterior: 0, promedioAnterior: 0 }
    const g = gananciaDiaPonderadaCop(rows, codigo, p.saldoAnterior, p.promedioAnterior)
    if (Math.abs(g) > 1e-6) out.push({ codigo, valor: g })
  }
  return out
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

function TarjetaBalanceCop({
  titulo,
  valorCop,
  loading: ld,
}: {
  titulo: string
  valorCop: number
  loading: boolean
}) {
  const bar = ld ? 'border-l-slate-400' : 'border-l-[#0047AB]'
  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${bar} border-l-[4px]`}>
      <div className="min-h-[4.5rem] bg-slate-50/40 px-2.5 py-2 pl-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{titulo}</h2>
        <p className="mt-1 truncate font-mono text-2xl font-bold leading-tight tabular-nums text-slate-900">
          {ld ? '…' : formatCOP(valorCop)}
        </p>
      </div>
    </div>
  )
}

function TarjetaResumenCop({
  titulo,
  valorCop,
  loading: ld,
  bar,
}: {
  titulo: string
  valorCop: number
  loading: boolean
  bar: string
}) {
  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${bar} border-l-[4px]`}>
      <div className="min-h-[4.5rem] bg-slate-50/40 px-2.5 py-2 pl-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{titulo}</h2>
        <p className="mt-1 truncate font-mono text-2xl font-bold leading-tight tabular-nums text-slate-900">
          {ld ? '…' : formatCOP(valorCop)}
        </p>
      </div>
    </div>
  )
}

function TarjetaCompacta({
  titulo,
  items,
  decItems = 4,
  accent,
  totalCopFooter,
  totalFooterLabel,
}: {
  titulo: string
  items: { codigo: string; valor: number }[]
  decItems?: number
  accent: 'emerald' | 'rose' | 'sky' | 'violet'
  /** Si está definido (incluye 0), muestra pie con total en COP. */
  totalCopFooter?: number
  totalFooterLabel?: string
}) {
  const bar =
    accent === 'emerald'
      ? 'border-l-emerald-500'
      : accent === 'rose'
        ? 'border-l-rose-500'
        : accent === 'sky'
          ? 'border-l-sky-500'
          : 'border-l-violet-500'
  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${bar} border-l-[4px]`}>
      <div className="min-h-[5.5rem] bg-slate-50/40 px-2.5 py-2 pl-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{titulo}</h2>
        {!items.length ? (
          <p className="mt-2 text-base text-slate-400">—</p>
        ) : (
          <ul className="mt-1 max-h-20 space-y-0.5 overflow-y-auto">
            {items.map((x) => (
              <li key={x.codigo} className="flex justify-between gap-2 font-mono text-sm tabular-nums text-slate-800">
                <span className="font-semibold">{x.codigo}</span>
                <span>{formatMilesEs(x.valor, decItems)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {totalCopFooter !== undefined && (
        <div className="border-t border-slate-200 bg-slate-50/90 px-2.5 py-2 pl-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            {totalFooterLabel ?? 'Total (COP)'}
          </p>
          <p className="truncate font-mono text-lg font-bold tabular-nums text-slate-900">{formatCOP(totalCopFooter)}</p>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { rows: divisasMaestro } = useDivisasMaestro()
  const { fecha: fechaDia } = useFechaOperativa()
  const monthKey = useMemo(() => String(fechaDia).slice(0, 7), [fechaDia])

  const [loading, setLoading] = useState(true)
  const [snapshotMode, setSnapshotMode] = useState(false)
  const [balanceSnap, setBalanceSnap] = useState<BalanceSnapRow | null>(null)
  const [sinBackupHistorico, setSinBackupHistorico] = useState(false)
  const [prevDeboTenerCop, setPrevDeboTenerCop] = useState<number | null>(null)

  const [txRows, setTxRows] = useState<Transaccion[]>([])
  const [debenRows, setDebenRows] = useState<{ divisa: string; monto: number }[]>([])
  const [deboRows, setDeboRows] = useState<{ divisa: string; monto: number }[]>([])
  const [rates, setRates] = useState<CopPorUnidad | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [trmFilas, setTrmFilas] = useState<TrmMercadoFila[]>([])
  const [ultimaTrm, setUltimaTrm] = useState<string | null>(null)
  const [cierresPrevRows, setCierresPrevRows] = useState<CierreRowParaArrastre[]>([])
  const [cargaInicialOpen, setCargaInicialOpen] = useState(false)
  const [invRows, setInvRows] = useState<{ divisa: string; cantidad_actual: number }[]>([])
  const [sumArqueoCop, setSumArqueoCop] = useState(0)
  const [cajaTotalCop, setCajaTotalCop] = useState(0)
  const [gastosDiaCop, setGastosDiaCop] = useState(0)
  const [acumGananciasCop, setAcumGananciasCop] = useState(0)
  const [acumGastosCop, setAcumGastosCop] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { desde, hastaExclusive } = dayBoundsLocal(fechaDia)
    const finAcumExclusive = hastaExclusive
    const hoy = fechaLocalYYYYMMDD()

    if (!user?.id) {
      setTxRows([])
      setDebenRows([])
      setDeboRows([])
      setCierresPrevRows([])
      setInvRows([])
      setSumArqueoCop(0)
      setCajaTotalCop(0)
      setGastosDiaCop(0)
      setAcumGananciasCop(0)
      setAcumGastosCop(0)
      setBalanceSnap(null)
      setSnapshotMode(false)
      setSinBackupHistorico(false)
      setPrevDeboTenerCop(null)
      setLoading(false)
      return
    }

    // Siempre operar contra la BD por fecha operativa (incluso en días pasados),
    // para poder editar cierres/carga inicial sin depender del snapshot.
    setSnapshotMode(false)
    setBalanceSnap(null)
    setSinBackupHistorico(false)

    let txQuery = supabase
      .from('transacciones')
      .select('*')
      .gte('fecha', desde)
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })
    txQuery = txQuery.eq('usuario_id', user.id)

    // Deudas versionadas: tomar última versión vigente hasta fin del día (orden desc para poder "pickear" por llave).
    let debenQ = supabase
      .from('deudas')
      .select('responsable,divisa,monto,fecha')
      .eq('tipo', 'DEBEN')
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })
      .limit(2000)
    let deboQ = supabase
      .from('deudas')
      .select('responsable,divisa,monto,fecha')
      .eq('tipo', 'DEBO')
      .lt('fecha', hastaExclusive)
      .order('fecha', { ascending: false })
      .limit(2000)
    let cierresPrevQ = supabase
      .from('cierres_diarios')
      .select('moneda,fecha,cierre_manual,promedio_compra,promedio_compra_acumulado')
      .lt('fecha', fechaDia)
    let invQ = supabase.from('inventario').select('divisa,cantidad_actual')
    let cajaCierreQ = supabase.from('caja_diaria').select('moneda,monto').eq('tipo', 'CIERRE').eq('fecha', fechaDia)
    // Usar último precio vigente <= fecha (igual que en Caja).
    let cajaPreciosQ = supabase
      .from('caja_precios')
      .select('moneda,precio_compra,fecha')
      .lte('fecha', fechaDia)
      .order('fecha', { ascending: false })
    let gastosQ = supabase.from('gastos').select('monto_cop').gte('fecha', desde).lt('fecha', hastaExclusive)
    let prevBalQ = supabase
      .from('balances_diarios')
      .select('fecha,debo_tener_total')
      .eq('usuario_id', user.id)
      .lt('fecha', fechaDia)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()
    let cierresAcumQ = supabase.from('cierres_diarios').select('fecha,ganancia_calculada').eq('usuario_id', user.id)
    let gastosAcumQ = supabase.from('gastos').select('monto_cop').eq('usuario_id', user.id).lt('fecha', finAcumExclusive)

    debenQ = debenQ.eq('usuario_id', user.id)
    deboQ = deboQ.eq('usuario_id', user.id)
    cierresPrevQ = cierresPrevQ.eq('usuario_id', user.id)
    invQ = invQ.eq('usuario_id', user.id)
    cajaCierreQ = cajaCierreQ.eq('usuario_id', user.id)
    cajaPreciosQ = cajaPreciosQ.eq('usuario_id', user.id)
    gastosQ = gastosQ.eq('usuario_id', user.id)

    const [txRes, ndRes, dbRes, cPrevRes, invRes, cierreRes, preciosRes, gastRes, prevBalRes, acumGanRes, acumGastRes] =
      await Promise.all([
        txQuery,
        debenQ,
        deboQ,
        cierresPrevQ,
        invQ,
        cajaCierreQ,
        cajaPreciosQ,
        gastosQ,
        prevBalQ,
        cierresAcumQ,
        gastosAcumQ,
      ])

    setTxRows((txRes.data ?? []) as Transaccion[])
    const foldLatestDeudas = (rows: unknown[]) => {
      const m = new Map<string, { divisa: string; monto: number }>()
      for (const rr of rows as Record<string, unknown>[]) {
        const responsable = String(rr.responsable ?? '')
        const divisa = String(rr.divisa ?? '')
        const key = `${responsable}||${divisa}`
        if (m.has(key)) continue
        const monto = Number(rr.monto ?? 0)
        if (!Number.isFinite(monto) || monto <= 1e-12) continue
        m.set(key, { divisa, monto })
      }
      return Array.from(m.values())
    }

    setDebenRows(foldLatestDeudas((ndRes.data ?? []) as unknown[]))
    setDeboRows(foldLatestDeudas((dbRes.data ?? []) as unknown[]))
    setCierresPrevRows((cPrevRes.error ? [] : cPrevRes.data) as CierreRowParaArrastre[])
    setInvRows((invRes.error ? [] : invRes.data ?? []) as { divisa: string; cantidad_actual: number }[])
    const precios = (preciosRes.error ? [] : preciosRes.data ?? []) as {
      moneda: string
      precio_compra: number
      fecha?: string
    }[]
    const pMap = new Map<string, number>()
    // Como viene ordenado DESC, el primer match por moneda es el último precio vigente.
    for (const r of precios) {
      const k = String(r.moneda).toUpperCase()
      if (!pMap.has(k)) pMap.set(k, Number(r.precio_compra))
    }
    const prevMap = saldoPromedioPorMonedaDesdeCierres((cPrevRes.error ? [] : cPrevRes.data ?? []) as CierreRowParaArrastre[])
    const fallbackBase = (prevMap.get('USD')?.promedioAnterior ?? 0) > 0 ? (prevMap.get('USD')?.promedioAnterior ?? 0) : prevMap.get('EUR')?.promedioAnterior ?? 0

    const cajaCop =
      cierreRes.error
        ? 0
        : (cierreRes.data ?? []).reduce((s, r) => {
            const row = r as { moneda: string; monto: number }
            const mon = String(row.moneda).toUpperCase()
            const cant = Number(row.monto)
            const saved = Number(pMap.get(mon) ?? 0)
            const fb = (prevMap.get(mon)?.promedioAnterior ?? 0) > 0 ? (prevMap.get(mon)?.promedioAnterior ?? 0) : fallbackBase
            const pc = saved > 0 ? saved : fb
            return s + cant * pc
          }, 0)
    setCajaTotalCop(cajaCop)
    setSumArqueoCop(cajaCop)
    setGastosDiaCop(
      gastRes.error
        ? 0
        : (gastRes.data ?? []).reduce((s, r) => s + Number((r as { monto_cop: number }).monto_cop), 0)
    )

    const prevTotal = prevBalRes.data?.debo_tener_total
    const prevFecha = prevBalRes.data?.fecha ? String((prevBalRes.data as any).fecha).slice(0, 10) : null
    const prevMonthKey = prevFecha ? prevFecha.slice(0, 7) : null
    setPrevDeboTenerCop(
      prevMonthKey === monthKey && prevTotal != null && Number.isFinite(Number(prevTotal)) ? Number(prevTotal) : null
    )

    setAcumGananciasCop(
      acumGanRes.error
        ? 0
        : sumGananciaHistoricaHastaFecha(
            (acumGanRes.data ?? []) as { fecha: string; ganancia_calculada: unknown }[],
            fechaDia
          )
    )
    setAcumGastosCop(
      acumGastRes.error
        ? 0
        : (acumGastRes.data ?? []).reduce((s, r) => s + Number((r as { monto_cop: number }).monto_cop ?? 0), 0)
    )
    setLoading(false)
  }, [supabase, fechaDia])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active || !user?.id) return

      channel = supabase
        .channel('dashboard-acumulados')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cierres_diarios', filter: `usuario_id=eq.${user.id}` },
          () => void load()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'gastos', filter: `usuario_id=eq.${user.id}` },
          () => void load()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'balances_diarios', filter: `usuario_id=eq.${user.id}` },
          () => void load()
        )
        .subscribe()
    })()

    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [supabase, load])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setRatesLoading(true)
      const res = await obtenerTrmMercado()
      if (cancelled) return
      setRates(res.rates)
      setTrmFilas(res.filas)
      setUltimaTrm(res.ultimaActualizacion)
      setRatesLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ultimoCierrePorMoneda = useMemo(() => saldoPromedioPorMonedaDesdeCierres(cierresPrevRows), [cierresPrevRows])

  const comprasLista = useMemo(() => {
    if (snapshotMode && balanceSnap?.detalle_tarjetas) {
      const dt = balanceSnap.detalle_tarjetas as DetalleTarjetasSnap
      return dt.compras ?? []
    }
    return sumTxMontoDivisa(txRows, 'COMPRA')
  }, [snapshotMode, balanceSnap, txRows])

  const ventasLista = useMemo(() => {
    if (snapshotMode && balanceSnap?.detalle_tarjetas) {
      const dt = balanceSnap.detalle_tarjetas as DetalleTarjetasSnap
      return dt.ventas ?? []
    }
    return sumTxMontoDivisa(txRows, 'VENTA')
  }, [snapshotMode, balanceSnap, txRows])

  const gananciaLista = useMemo(() => {
    if (snapshotMode && balanceSnap?.detalle_tarjetas) {
      const dt = balanceSnap.detalle_tarjetas as DetalleTarjetasSnap
      const g = dt.ganancia ?? []
      return g.map((x) => ({ codigo: x.codigo, valor: Number(x.valor_cop) }))
    }
    return gananciaListaDesdeTx(txRows, ultimoCierrePorMoneda)
  }, [snapshotMode, balanceSnap, txRows, ultimoCierrePorMoneda])

  const totalGananciaDiaCop = useMemo(() => {
    if (snapshotMode && balanceSnap) return Number(balanceSnap.ganancias_dia)
    return gananciaLista.reduce((s, x) => s + x.valor, 0)
  }, [snapshotMode, balanceSnap, gananciaLista])

  const nosDebenLista = useMemo(() => {
    if (snapshotMode && balanceSnap?.detalle_deudas) {
      const d = balanceSnap.detalle_deudas as { deben?: { codigo: string; valor_divisa: number }[] }
      const arr = d.deben ?? []
      return arr.map((x) => ({ codigo: x.codigo, valor: Number(x.valor_divisa) }))
    }
    return sumDeudasPendientes(debenRows)
  }, [snapshotMode, balanceSnap, debenRows])

  const debemosLista = useMemo(() => {
    if (snapshotMode && balanceSnap?.detalle_deudas) {
      const d = balanceSnap.detalle_deudas as { debo?: { codigo: string; valor_divisa: number }[] }
      const arr = d.debo ?? []
      return arr.map((x) => ({ codigo: x.codigo, valor: Number(x.valor_divisa) }))
    }
    return sumDeudasPendientes(deboRows)
  }, [snapshotMode, balanceSnap, deboRows])

  const copMap = useMemo<CopPorUnidad>(
    () =>
      rates ?? {
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
      },
    [rates]
  )

  const balanceLoading = loading || (ratesLoading && !snapshotMode)

  const monedasAudit = useMemo(
    () => monedasParaAuditoria(txRows, invRows, ultimoCierrePorMoneda),
    [txRows, invRows, ultimoCierrePorMoneda]
  )

  const filasAuditVivo = useMemo(
    () => filasAuditoriaVivo(txRows, ultimoCierrePorMoneda, monedasAudit),
    [txRows, ultimoCierrePorMoneda, monedasAudit]
  )

  /** Arqueo por divisa valorado a precio de compra + deudas (me deben − debo), COP. */
  const tengoCop = useMemo(() => {
    if (snapshotMode && balanceSnap) return Number(balanceSnap.tengo_total)
    return sumArqueoCop + saldoDeudasNetoCop(debenRows, deboRows, copMap)
  }, [snapshotMode, balanceSnap, sumArqueoCop, debenRows, deboRows, copMap])

  /**
   * Debo tener = último backup `debo_tener_total` anterior al día + ganancia del día − gastos del día.
   * Sin cadena previa: capital base `tengo` + ganancia del día − gastos del día.
   */
  const deboTenerCop = useMemo(() => {
    if (snapshotMode && balanceSnap) return Number(balanceSnap.debo_tener_total)
    // Primera operación del mes: Debo tener = Tengo (no arrastra ganancia/gastos).
    if (prevDeboTenerCop == null) return tengoCop
    if (prevDeboTenerCop != null && Number.isFinite(prevDeboTenerCop)) {
      return prevDeboTenerCop + totalGananciaDiaCop - gastosDiaCop
    }
    return tengoCop + totalGananciaDiaCop - gastosDiaCop
  }, [snapshotMode, balanceSnap, prevDeboTenerCop, totalGananciaDiaCop, gastosDiaCop, tengoCop])

  const totalDebenCop = useMemo(() => {
    if (snapshotMode && balanceSnap) return Number(balanceSnap.me_deben_total)
    return totalDeudasMontoCop(debenRows, copMap)
  }, [snapshotMode, balanceSnap, debenRows, copMap])

  const totalDeboCop = useMemo(() => {
    if (snapshotMode && balanceSnap) return Number(balanceSnap.debo_total)
    return totalDeudasMontoCop(deboRows, copMap)
  }, [snapshotMode, balanceSnap, deboRows, copMap])
  const utilidadNetaCop = useMemo(() => acumGananciasCop - acumGastosCop, [acumGananciasCop, acumGastosCop])

  const etiquetaMoneda = useMemo(() => {
    const opt = divisasMaestro.length ? divisasMaestro : DIVISAS_FALLBACK
    return (codigo: string) => {
      const d = opt.find((x) => x.codigo === codigo)
      return d ? `${d.nombre_completo} (${codigo})` : codigo
    }
  }, [divisasMaestro])

  const filasPorCodigo = useMemo(() => {
    const m = new Map<string, TrmMercadoFila>()
    for (const f of trmFilas) m.set(f.codigo, f)
    return m
  }, [trmFilas])

  const recientes = useMemo(() => txRows.slice(0, 10), [txRows])

  return (
    <main className="space-y-6 text-base text-black">
      {sinBackupHistorico ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No hay backup en <span className="font-mono font-semibold">{fechaDia}</span>. Los valores que ves son estimaciones en
          tiempo real (no congelados); ejecute un cierre en Caja para generar el snapshot en{' '}
          <span className="font-mono">balances_diarios</span>.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <TarjetaCompacta titulo="Compra" items={loading ? [] : comprasLista} accent="sky" />
        <TarjetaCompacta titulo="Venta" items={loading ? [] : ventasLista} accent="rose" />
        <TarjetaCompacta
          titulo="Ganancia"
          items={loading ? [] : gananciaLista}
          decItems={0}
          accent="emerald"
          totalCopFooter={loading ? undefined : totalGananciaDiaCop}
          totalFooterLabel="Total ganancia (COP)"
        />
        <TarjetaCompacta
          titulo="Me deben"
          items={loading ? [] : nosDebenLista}
          accent="violet"
          totalCopFooter={balanceLoading ? undefined : totalDebenCop}
          totalFooterLabel="Total en COP"
        />
        <TarjetaCompacta
          titulo="Debo"
          items={loading ? [] : debemosLista}
          accent="rose"
          totalCopFooter={balanceLoading ? undefined : totalDeboCop}
          totalFooterLabel="Total en COP"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <TarjetaResumenCop
          titulo="Acumulado ganancias"
          valorCop={acumGananciasCop}
          loading={loading}
          bar="border-l-sky-600"
        />
        <TarjetaResumenCop
          titulo="Acumulado gastos"
          valorCop={acumGastosCop}
          loading={loading}
          bar="border-l-orange-500"
        />
        <TarjetaResumenCop
          titulo="Diferencia"
          valorCop={utilidadNetaCop}
          loading={loading}
          bar="border-l-violet-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <TarjetaBalanceCop titulo="Caja (COP)" valorCop={snapshotMode ? Number((balanceSnap as any)?.caja_total_cop ?? 0) : cajaTotalCop} loading={balanceLoading} />
        <TarjetaBalanceCop titulo="Tengo" valorCop={tengoCop} loading={balanceLoading} />
        <TarjetaBalanceCop titulo="Debo tener" valorCop={deboTenerCop} loading={balanceLoading} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 shadow-md">
        <div className="mb-2 flex justify-end">
          <span className="text-sm text-slate-500">{ratesLoading ? '…' : textoActualizado(ultimaTrm)}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TRM_TICKER_ORDER.map((code) => {
            const f = filasPorCodigo.get(code)
            const v = f?.valor_cop ?? copMap[code]
            const show = !ratesLoading && Number(v) > 0
            return (
              <div
                key={code}
                className="min-w-[92px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center shadow-sm"
              >
                <p className="text-base leading-none" aria-hidden>
                  {FLAGS[code] ?? '💱'}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">{code}</p>
                <p className="font-mono text-base font-semibold tabular-nums">{show ? formatCOP(Number(v)) : '—'}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCargaInicialOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              <Package className="h-3.5 w-3.5" aria-hidden />
              Carga inicial
            </button>
            <button
              type="button"
              disabled={snapshotMode || filasAuditVivo.length === 0}
              onClick={() => exportAuditoriaVivoExcel(filasAuditVivo, fechaDia, etiquetaMoneda)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-white disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Excel
            </button>
          </div>
        </div>
        {loading ? (
          <p className="p-4 text-center text-base text-slate-500">…</p>
        ) : filasAuditVivo.length === 0 ? (
          <p className="p-4 text-center text-base text-slate-500">Sin divisas con saldo o movimiento para este día.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-center text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100">
                  <th className="px-1.5 py-2 font-bold text-slate-700">Fecha</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Moneda</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Cant. inicial</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Prom. compra ant.</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Cant. final</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Prom. compra hoy</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Prom. venta hoy</th>
                  <th className="px-1.5 py-2 font-bold text-slate-700">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {filasAuditVivo.map((row) => (
                  <tr key={row.moneda} className="border-b border-slate-100">
                    <td className="px-1.5 py-1.5 font-mono text-slate-800">{fechaDia}</td>
                    <td className="px-1.5 py-1.5 text-left font-medium sm:text-center">{etiquetaMoneda(row.moneda)}</td>
                    <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(row.cantidadInicial, 4)}</td>
                    <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(row.promedioAnterior, 2)}</td>
                    <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(row.cantidadFinal, 4)}</td>
                    <td className="px-1.5 py-1.5 font-mono tabular-nums">{formatMilesEs(row.promedioCompraHoy, 2)}</td>
                    <td className="px-1.5 py-1.5 font-mono tabular-nums">
                      {row.promedioVentaHoy > 1e-12 ? formatMilesEs(row.promedioVentaHoy, 2) : formatMilesEs(0, 2)}
                    </td>
                    <td className="px-1.5 py-1.5 font-mono tabular-nums font-semibold text-slate-900">
                      {Math.abs(row.gananciaCop) < 1e-6 ? formatMilesEs(0, 0) : formatCOP(row.gananciaCop)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CargaInicialDialog
        open={cargaInicialOpen}
        onClose={() => setCargaInicialOpen(false)}
        onGuardado={() => void load()}
      />

      <p className="text-sm text-slate-500">
        <a href="/caja" className="font-semibold underline">
          Caja
        </a>{' '}
        ·{' '}
        <a href="/historial" className="font-semibold underline">
          Historial
        </a>
      </p>
    </main>
  )
}
