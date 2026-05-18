'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarRange, Download, Save } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { useFechaOperativa } from '@/components/fecha-operativa/FechaOperativaProvider'
import { dayBoundsLocal, formatCOP, formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { sumGananciaAcumuladaCombinada } from '@/lib/gananciaCierres'
import { saldoDeudasNetoCop, totalDeudasMontoCop } from '@/lib/balanceCop'
import type { Database } from '@/database'
import { saldoPromedioPorMonedaDesdeCierres, type CierreRowParaArrastre } from '@/lib/ultimoCierre'
import { exportAuditoriaVivoExcel } from '@/lib/exportCierresExcel'
import { obtenerTrmMercado } from '@/app/actions/trm'
import { TRM_TICKER_ORDER, type TrmMercadoFila } from '@/lib/trm-ticker'
import {
  filasAuditoriaVivo,
  gananciaListaDesdeAuditoria,
  monedasParaAuditoria,
  type AuditoriaOverrideVals,
} from '@/lib/auditoriaVivo'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import type { Transaccion } from '@/types/database'
import type { CopPorUnidad } from '@/lib/trm'
import { toast } from 'sonner'
import { AuditoriaVivoTable } from '@/components/auditoria/AuditoriaVivoTable'
import { DialogAjusteGanancia } from '@/components/auditoria/DialogAjusteGanancia'

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
    <div
      className={`overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-slate-100/60 shadow-md ring-1 ring-slate-200/50 ${bar} border-l-[4px]`}
    >
      <div className="min-h-[4.75rem] px-3 py-2.5 pl-3.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>
        <p className="mt-1 min-w-0 break-words text-pretty font-mono text-lg font-bold leading-snug tabular-nums text-slate-900 sm:text-xl">
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
  hint,
  onAjustar,
}: {
  titulo: string
  valorCop: number
  loading: boolean
  bar: string
  hint?: string
  onAjustar?: () => void
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-slate-100/60 shadow-md ring-1 ring-slate-200/50 ${bar} border-l-[4px]`}
    >
      <div className="min-h-[4.75rem] px-3 py-2.5 pl-3.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>
          {onAjustar ? (
            <button
              type="button"
              onClick={onAjustar}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
            >
              Ajustar
            </button>
          ) : null}
        </div>
        {hint ? <p className="mt-0.5 text-[10px] font-semibold text-amber-800">{hint}</p> : null}
        <p className="mt-1 min-w-0 break-words text-pretty font-mono text-lg font-bold leading-snug tabular-nums text-slate-900 sm:text-xl">
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
  hintTitulo,
}: {
  titulo: string
  items: { codigo: string; valor: number }[]
  decItems?: number
  accent: 'emerald' | 'rose' | 'sky' | 'violet'
  /** Si está definido (incluye 0), muestra pie con total en COP. */
  totalCopFooter?: number
  totalFooterLabel?: string
  hintTitulo?: string
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
    <div
      className={`overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-slate-100/60 shadow-md ring-1 ring-slate-200/50 ${bar} border-l-[4px]`}
    >
      <div className="min-h-[5.75rem] px-3 py-2.5 pl-3.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</h2>
        {hintTitulo ? (
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">{hintTitulo}</p>
        ) : null}
        {!items.length ? (
          <p className="mt-2 text-base text-slate-400">—</p>
        ) : (
          <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto pr-0.5">
            {items.map((x) => (
              <li
                key={x.codigo}
                className="flex min-w-0 justify-between gap-2 font-mono text-sm tabular-nums text-slate-800"
              >
                <span className="shrink-0 font-semibold">{x.codigo}</span>
                <span className="min-w-0 shrink text-right break-words">{formatMilesEs(x.valor, decItems)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {totalCopFooter !== undefined && (
        <div className="border-t border-slate-200/90 bg-white/80 px-3 py-2.5 pl-3.5 backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {totalFooterLabel ?? 'Total (COP)'}
          </p>
          <p className="mt-0.5 min-w-0 break-words text-pretty font-mono text-base font-bold leading-snug tabular-nums text-slate-900 sm:text-lg">
            {formatCOP(totalCopFooter)}
          </p>
        </div>
      )}
    </div>
  )
}

function DashboardPageInner() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const searchParams = useSearchParams()
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
  // Carga inicial ahora se edita inline en la tabla (overrides), no en un diálogo.
  const [invRows, setInvRows] = useState<{ divisa: string; cantidad_actual: number }[]>([])
  const [sumArqueoCop, setSumArqueoCop] = useState(0)
  const [cajaTotalCop, setCajaTotalCop] = useState(0)
  const [gastosDiaCop, setGastosDiaCop] = useState(0)
  const [acumGananciasCop, setAcumGananciasCop] = useState(0)
  const [gananciaAcumInicialCop, setGananciaAcumInicialCop] = useState(0)
  const [acumGastosCop, setAcumGastosCop] = useState(0)
  const [auditOverrides, setAuditOverrides] = useState<Map<string, AuditoriaOverrideVals>>(() => new Map())
  const [editAudit, setEditAudit] = useState(false)
  /** Ganancia total COP del día operativa forzada manualmente (tabla `ganancia_dia_override`). */
  const [gananciaDiaOverrideCop, setGananciaDiaOverrideCop] = useState<number | null>(null)
  const [dialogGanDiaOpen, setDialogGanDiaOpen] = useState(false)

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
      setGananciaDiaOverrideCop(null)
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
      .select('moneda,fecha,cierre_manual,promedio_compra,promedio_compra_acumulado,id,created_at')
      .lt('fecha', fechaDia)
    let invQ = supabase.from('inventario').select('divisa,cantidad_actual')
    let cajaCierreQ = supabase.from('caja_diaria').select('moneda,monto').eq('tipo', 'CIERRE').eq('fecha', fechaDia)
    // Usar último precio vigente <= fecha (igual que en Caja).
    let cajaPreciosQ = supabase
      .from('caja_precios')
      .select('moneda,precio_compra,fecha,ultima_modificacion')
      .lte('fecha', fechaDia)
      .order('fecha', { ascending: false })
      .order('ultima_modificacion', { ascending: false })
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
    let balancesAcumQ = supabase
      .from('balances_diarios')
      .select('fecha,ganancias_dia')
      .eq('usuario_id', user.id)
      .lte('fecha', fechaDia)
    let acumInicialQ = supabase
      .from('ganancia_acumulada_inicial')
      .select('monto_cop')
      .eq('usuario_id', user.id)
      .maybeSingle()
    let gastosAcumQ = supabase.from('gastos').select('monto_cop').eq('usuario_id', user.id).lt('fecha', finAcumExclusive)

    debenQ = debenQ.eq('usuario_id', user.id)
    deboQ = deboQ.eq('usuario_id', user.id)
    cierresPrevQ = cierresPrevQ.eq('usuario_id', user.id)
    invQ = invQ.eq('usuario_id', user.id)
    cajaCierreQ = cajaCierreQ.eq('usuario_id', user.id)
    cajaPreciosQ = cajaPreciosQ.eq('usuario_id', user.id)
    gastosQ = gastosQ.eq('usuario_id', user.id)

    const ovQ = (supabase as any)
      .from('auditoria_overrides')
      .select('moneda,cantidad_inicial,promedio_anterior,promedio_compra_hoy,ganancia_cop')
      .eq('usuario_id', user.id)
      .eq('fecha', fechaDia)

    const ganDiaOvQ = supabase
      .from('ganancia_dia_override')
      .select('ganancia_cop')
      .eq('usuario_id', user.id)
      .eq('fecha', fechaDia)
      .maybeSingle()

    const [
      txRes,
      ndRes,
      dbRes,
      cPrevRes,
      invRes,
      cierreRes,
      preciosRes,
      gastRes,
      prevBalRes,
      acumGanRes,
      balancesAcumRes,
      acumInicialRes,
      acumGastRes,
      ovRes,
      ganOvRes,
    ] = await Promise.all([
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
      balancesAcumQ,
      acumInicialQ,
      gastosAcumQ,
      ovQ,
      ganDiaOvQ,
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
        // IMPORTANTE: aunque el monto sea 0 (SALDADO), se debe registrar como "última versión"
        // para que NO se caiga al registro anterior.
        m.set(key, { divisa, monto: Number.isFinite(monto) ? monto : 0 })
      }
      return Array.from(m.values()).filter((x) => Number(x.monto) > 1e-12)
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

    const acumInicial =
      acumInicialRes.error || !acumInicialRes.data
        ? 0
        : Number((acumInicialRes.data as { monto_cop?: unknown }).monto_cop ?? 0)
    const acumInicialOk = Number.isFinite(acumInicial) ? acumInicial : 0
    setGananciaAcumInicialCop(acumInicialOk)

    const ganEnApp = acumGanRes.error
      ? 0
      : sumGananciaAcumuladaCombinada(
          (acumGanRes.data ?? []) as { fecha: string; ganancia_calculada: unknown }[],
          balancesAcumRes.error ? [] : ((balancesAcumRes.data ?? []) as { fecha: string; ganancias_dia: unknown }[]),
          fechaDia
        )
    setAcumGananciasCop(acumInicialOk + ganEnApp)
    setAcumGastosCop(
      acumGastRes.error
        ? 0
        : (acumGastRes.data ?? []).reduce((s, r) => s + Number((r as { monto_cop: number }).monto_cop ?? 0), 0)
    )

    const ovMap = new Map<string, AuditoriaOverrideVals>()
    for (const r of (ovRes?.error ? [] : ovRes?.data ?? []) as Record<string, unknown>[]) {
      const mon = String(r.moneda ?? '').toUpperCase()
      if (!mon) continue
      ovMap.set(mon, {
        cantidad_inicial: (r as any).cantidad_inicial ?? null,
        promedio_anterior: (r as any).promedio_anterior ?? null,
        promedio_compra_hoy: (r as any).promedio_compra_hoy ?? null,
        ganancia_cop: (r as any).ganancia_cop != null ? Number((r as any).ganancia_cop) : null,
      })
    }
    setAuditOverrides(ovMap)

    const gOvRow = ganOvRes.error ? null : ganOvRes.data
    const gOv = gOvRow != null && (gOvRow as { ganancia_cop?: unknown }).ganancia_cop != null ? Number((gOvRow as any).ganancia_cop) : null
    setGananciaDiaOverrideCop(gOv != null && Number.isFinite(gOv) ? gOv : null)

    setLoading(false)
  }, [supabase, fechaDia])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (searchParams.get('editar') === '1') setEditAudit(true)
  }, [searchParams])

  const abrirDialogAjusteGanancias = useCallback(() => {
    setDialogGanDiaOpen(true)
  }, [])

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
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'auditoria_overrides', filter: `usuario_id=eq.${user.id}` },
          () => void load()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ganancia_dia_override', filter: `usuario_id=eq.${user.id}` },
          () => void load()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ganancia_acumulada_inicial', filter: `usuario_id=eq.${user.id}` },
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
    if (gananciaDiaOverrideCop != null && Number.isFinite(gananciaDiaOverrideCop)) {
      return [{ codigo: 'TOTAL', valor: gananciaDiaOverrideCop }]
    }
    return gananciaListaDesdeAuditoria(txRows, invRows, ultimoCierrePorMoneda, auditOverrides)
  }, [snapshotMode, balanceSnap, txRows, invRows, ultimoCierrePorMoneda, auditOverrides, gananciaDiaOverrideCop])

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
    () => filasAuditoriaVivo(txRows, ultimoCierrePorMoneda, monedasAudit, auditOverrides),
    [txRows, ultimoCierrePorMoneda, monedasAudit, auditOverrides]
  )

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
          hintTitulo={
            !snapshotMode && gananciaDiaOverrideCop != null && Number.isFinite(gananciaDiaOverrideCop)
              ? 'Total del día ajustado'
              : undefined
          }
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
          hint={
            Math.abs(gananciaAcumInicialCop) > 1e-6
              ? `Incluye ${formatCOP(gananciaAcumInicialCop)} de arranque`
              : undefined
          }
          onAjustar={() => abrirDialogAjusteGanancias()}
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

      <section className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-200/40">
        {loading ? (
          <p className="p-4 text-center text-base text-slate-500">…</p>
        ) : filasAuditVivo.length === 0 ? (
          <p className="p-4 text-center text-base text-slate-500">Sin divisas con saldo o movimiento para este día.</p>
        ) : (
          <AuditoriaVivoTable
            fechaDia={fechaDia}
            filas={filasAuditVivo}
            auditOverrides={auditOverrides}
            editAudit={editAudit}
            etiquetaMoneda={etiquetaMoneda}
            onSaved={load}
          />
        )}
        {!loading && filasAuditVivo.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 px-3 py-4">
            <button
              type="button"
              onClick={() => setEditAudit((v) => !v)}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <Save className="mr-1.5 inline h-4 w-4" aria-hidden />
              {editAudit ? 'Solo ver' : 'Editar promedios / ganancia'}
            </button>
            <button
              type="button"
              disabled={snapshotMode}
              onClick={() => exportAuditoriaVivoExcel(filasAuditVivo, fechaDia, etiquetaMoneda)}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="mr-1.5 inline h-4 w-4" aria-hidden />
              Excel
            </button>
            <button
              type="button"
              disabled={balanceLoading}
              onClick={() => abrirDialogAjusteGanancias()}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <CalendarRange className="mr-1.5 inline h-4 w-4" aria-hidden />
              Ajustar ganancia
            </button>
          </div>
        ) : null}
      </section>

      <p className="text-sm text-slate-500">
        <a href="/caja" className="font-semibold underline">
          Caja
        </a>{' '}
        ·{' '}
        <a href="/historial" className="font-semibold underline">
          Historial
        </a>
      </p>

      <DialogAjusteGanancia
        open={dialogGanDiaOpen}
        onClose={() => setDialogGanDiaOpen(false)}
        fechaDia={fechaDia}
        gananciaAcumInicialCop={gananciaAcumInicialCop}
        onSaved={load}
      />
    </main>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="p-6 text-center text-base text-slate-500" aria-busy="true">
          …
        </main>
      }
    >
      <DashboardPageInner />
    </Suspense>
  )
}
