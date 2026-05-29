'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, X, FileSpreadsheet } from 'lucide-react'
import { formatCOP, formatDate, formatMilesEs, isoTimestampForPostgrestFilter } from '@/lib/utils'
import { totalCopFromTasa } from '@/lib/pricing'
import { SkeletonTable } from '@/components/ui/Skeletons'
import type { MetodoPago, Transaccion } from '@/types/database'
import { toast } from 'sonner'
import { actualizarTransaccionesHistorial } from '@/app/actions/historialTransacciones'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'

const PAGE_SIZE = 15

interface Filters {
  dateFrom: string
  dateTo: string
  tipo: '' | 'COMPRA' | 'VENTA'
}

type BorradorFila = {
  tipo: 'COMPRA' | 'VENTA'
  moneda: string
  monto_divisa: string
  tasa_aplicada: string
  metodo_pago: MetodoPago
}

const METODOS: MetodoPago[] = ['Efectivo', 'Nequi', 'Cheque']

const inputEdit =
  'w-full min-w-0 rounded-md border border-slate-200 bg-slate-50/90 py-2 px-1 text-center text-base font-mono shadow-inner focus:border-blue-500 focus:bg-white focus:outline-none'

export default function HistorialPage() {
  const supabase = createBrowserSupabaseClient()
  const { rows: divisasMaestro } = useDivisasMaestro()
  const opcionesDivisa = divisasMaestro.length ? divisasMaestro : DIVISAS_FALLBACK

  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [rows, setRows] = useState<Transaccion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Filters>({
    dateFrom: '',
    dateTo: '',
    tipo: '',
  })
  const [modoEdicion, setModoEdicion] = useState(false)
  const [borrador, setBorrador] = useState<Record<string, BorradorFila>>({})
  const [guardando, setGuardando] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    let query = supabase
      .from('transacciones')
      .select('*', { count: 'exact' })
      .order('fecha', { ascending: false })
    if (user?.id) query = query.eq('usuario_id', user.id)

    if (filters.dateFrom) {
      const [y, m, d] = filters.dateFrom.split('-').map(Number)
      const desde = new Date(y, m - 1, d, 0, 0, 0, 0)
      query = query.gte('fecha', isoTimestampForPostgrestFilter(desde))
    }
    if (filters.dateTo) {
      const [y, m, d] = filters.dateTo.split('-').map(Number)
      const hastaExc = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
      query = query.lt('fecha', isoTimestampForPostgrestFilter(hastaExc))
    }
    if (filters.tipo) query = query.eq('tipo', filters.tipo)

    const from = (page - 1) * PAGE_SIZE
    const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (!error) {
      setRows((data ?? []) as Transaccion[])
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [supabase, page, filters])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!modoEdicion) {
      setBorrador({})
      return
    }
    const next: Record<string, BorradorFila> = {}
    for (const tx of rows) {
      next[tx.id] = {
        tipo: tx.tipo,
        moneda: tx.moneda,
        monto_divisa: String(tx.monto_divisa),
        tasa_aplicada: String(tx.tasa_aplicada),
        metodo_pago: (tx.metodo_pago ?? 'Efectivo') as MetodoPago,
      }
    }
    setBorrador(next)
  }, [modoEdicion, rows])

  const resetFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', tipo: '' })
    setPage(1)
  }

  const hasFilters = Boolean(filters.dateFrom || filters.dateTo || filters.tipo)

  const exportarExcel = async () => {
    setExporting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const pageSize = 1000
      const all: Transaccion[] = []
      for (let offset = 0; ; offset += pageSize) {
        let q = supabase.from('transacciones').select('*').order('fecha', { ascending: false })
        if (user?.id) q = q.eq('usuario_id', user.id)
        if (filters.dateFrom) {
          const [y, m, d] = filters.dateFrom.split('-').map(Number)
          const desde = new Date(y, m - 1, d, 0, 0, 0, 0)
          q = q.gte('fecha', isoTimestampForPostgrestFilter(desde))
        }
        if (filters.dateTo) {
          const [y, m, d] = filters.dateTo.split('-').map(Number)
          const hastaExc = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
          q = q.lt('fecha', isoTimestampForPostgrestFilter(hastaExc))
        }
        if (filters.tipo) q = q.eq('tipo', filters.tipo)
        const { data, error } = await q.range(offset, offset + pageSize - 1)
        if (error) throw error
        const chunk = (data ?? []) as Transaccion[]
        all.push(...chunk)
        if (chunk.length < pageSize) break
        if (all.length > 20000) {
          toast('Se exportaron las primeras 20.000 filas como máximo.')
          break
        }
      }

      const exportRows = all.map((tx) => ({
        Fecha: formatDate(tx.fecha),
        Tipo: tx.tipo,
        Divisa: tx.moneda,
        'Monto divisa': tx.monto_divisa,
        'Tasa COP/1': tx.tasa_aplicada,
        'Total COP': tx.total_cop,
        Pago: tx.metodo_pago ?? 'Efectivo',
      }))
      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Transacciones')
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      XLSX.writeFile(wb, `historial-${stamp}.xlsx`)
      toast.success('Excel descargado')
    } catch {
      toast.error('No se pudo exportar')
    } finally {
      setExporting(false)
    }
  }

  const onModificarOGuardar = async () => {
    if (!modoEdicion) {
      setModoEdicion(true)
      return
    }

    setGuardando(true)
    try {
      const payload = rows.map((tx) => {
        const b = borrador[tx.id]
        if (!b) return null
        const monto = Number(b.monto_divisa)
        const tasa = Number(b.tasa_aplicada)
        if (!Number.isFinite(monto) || monto <= 0 || !Number.isFinite(tasa) || tasa <= 0) return null
        return {
          id: tx.id,
          tipo: b.tipo,
          moneda: b.moneda.trim().toUpperCase(),
          monto_divisa: monto,
          tasa_aplicada: tasa,
          metodo_pago: b.metodo_pago,
        }
      })
      const clean = payload.filter((x): x is NonNullable<typeof x> => x != null)
      if (clean.length === 0) {
        toast.error('Revise montos y tasas.')
        return
      }
      const res = await actualizarTransaccionesHistorial(clean)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Cambios guardados')
      setModoEdicion(false)
      await fetchData()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 text-base">
      <header className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={exporting || total === 0}
            onClick={() => void exportarExcel()}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            {exporting ? 'Exportando…' : 'Exportar a Excel'}
          </button>
          <button
            type="button"
            disabled={rows.length === 0 || guardando}
            onClick={() => void onModificarOGuardar()}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-bold shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${
              modoEdicion
                ? 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border-slate-400 bg-white text-slate-900 hover:bg-slate-50'
            }`}
          >
            {guardando ? 'Guardando…' : modoEdicion ? 'Guardar cambios' : 'Modificar registros'}
          </button>
        </div>
      </header>

      {modoEdicion ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-950">
          Modo edición: no cambie de página hasta guardar o recargar la página para descartar.
        </p>
      ) : null}

      <div className="card-pro border border-slate-100 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-black"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="label text-base">Desde</label>
            <input
              type="date"
              disabled={modoEdicion}
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
                setPage(1)
              }}
              className="input-field min-h-[48px] text-base disabled:opacity-50"
            />
          </div>
          <div>
            <label className="label text-base">Hasta</label>
            <input
              type="date"
              disabled={modoEdicion}
              value={filters.dateTo}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
                setPage(1)
              }}
              className="input-field min-h-[48px] text-base disabled:opacity-50"
            />
          </div>
          <div>
            <label className="label text-base">Tipo</label>
            <select
              disabled={modoEdicion}
              value={filters.tipo}
              onChange={(e) => {
                setFilters((f) => ({
                  ...f,
                  tipo: e.target.value as Filters['tipo'],
                }))
                setPage(1)
              }}
              className="input-field min-h-[48px] text-base disabled:opacity-50"
            >
              <option value="">Todos</option>
              <option value="COMPRA">Compra</option>
              <option value="VENTA">Venta</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={PAGE_SIZE} cols={8} />
      ) : (
        <div className="card-pro overflow-hidden border border-slate-100">
          <table className="w-full border-collapse text-center text-base">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100">
                <th className="table-header">#</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Divisa</th>
                <th className="table-header">Monto</th>
                <th className="table-header">Tasa</th>
                <th className="table-header">Total COP</th>
                <th className="table-header">Pago</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table-cell py-10 text-center text-slate-500">
                    Sin resultados
                  </td>
                </tr>
              ) : (
                rows.map((tx, idx) => {
                  const b = borrador[tx.id]
                  const totalPreview =
                    b && Number(b.monto_divisa) > 0 && Number(b.tasa_aplicada) > 0
                      ? totalCopFromTasa(Number(b.monto_divisa), Number(b.tasa_aplicada))
                      : tx.total_cop
                  return (
                    <tr key={tx.id} className="table-row-striped hover:bg-slate-50/80">
                      <td className="table-cell text-base text-slate-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="table-cell text-base text-slate-700">{formatDate(tx.fecha)}</td>
                      <td className="table-cell align-middle">
                        {modoEdicion && b ? (
                          <select
                            value={b.tipo}
                            onChange={(e) =>
                              setBorrador((prev) => ({
                                ...prev,
                                [tx.id]: { ...b, tipo: e.target.value as 'COMPRA' | 'VENTA' },
                              }))
                            }
                            className={inputEdit}
                          >
                            <option value="COMPRA">COMPRA</option>
                            <option value="VENTA">VENTA</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-base font-medium ${
                              tx.tipo === 'COMPRA'
                                ? 'border-slate-100 bg-slate-50 text-slate-800'
                                : 'border-slate-100 bg-white text-slate-800'
                            }`}
                          >
                            {tx.tipo === 'COMPRA' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                            {tx.tipo}
                          </span>
                        )}
                      </td>
                      <td className="table-cell align-middle">
                        {modoEdicion && b ? (
                          <select
                            value={b.moneda}
                            onChange={(e) =>
                              setBorrador((prev) => ({
                                ...prev,
                                [tx.id]: { ...b, moneda: e.target.value },
                              }))
                            }
                            className={inputEdit}
                          >
                            {opcionesDivisa.map((d) => (
                              <option key={d.codigo} value={d.codigo}>
                                {d.codigo}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-medium">{tx.moneda}</span>
                        )}
                      </td>
                      <td className="table-cell align-middle">
                        {modoEdicion && b ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={b.monto_divisa}
                            onChange={(e) =>
                              setBorrador((prev) => ({
                                ...prev,
                                [tx.id]: { ...b, monto_divisa: e.target.value },
                              }))
                            }
                            className={inputEdit}
                          />
                        ) : (
                          <span className="font-mono">{formatMilesEs(Number(tx.monto_divisa), 4)}</span>
                        )}
                      </td>
                      <td className="table-cell align-middle">
                        {modoEdicion && b ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={b.tasa_aplicada}
                            onChange={(e) =>
                              setBorrador((prev) => ({
                                ...prev,
                                [tx.id]: { ...b, tasa_aplicada: e.target.value },
                              }))
                            }
                            className={inputEdit}
                          />
                        ) : (
                          <span className="font-mono text-base">{formatMilesEs(tx.tasa_aplicada, 2)}</span>
                        )}
                      </td>
                      <td className="table-cell font-mono font-medium">
                        {modoEdicion && b ? formatCOP(totalPreview) : formatCOP(tx.total_cop)}
                      </td>
                      <td className="table-cell align-middle text-base">
                        {modoEdicion && b ? (
                          <select
                            value={b.metodo_pago}
                            onChange={(e) =>
                              setBorrador((prev) => ({
                                ...prev,
                                [tx.id]: { ...b, metodo_pago: e.target.value as MetodoPago },
                              }))
                            }
                            className={inputEdit}
                          >
                            {METODOS.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        ) : (
                          tx.metodo_pago ?? 'Efectivo'
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
            <p className="text-sm text-slate-600">
              Página {page} / {totalPages} · {total} resultados
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || modoEdicion}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-100 bg-white text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || modoEdicion}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-100 bg-white text-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
