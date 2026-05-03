'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import * as XLSX from 'xlsx'
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, Filter, X, FileSpreadsheet } from 'lucide-react'
import { formatCOP, formatDate, formatMilesEs, isoTimestampForPostgrestFilter } from '@/lib/utils'
import { SkeletonTable } from '@/components/ui/Skeletons'
import type { Transaccion } from '@/types/database'
import { toast } from 'sonner'

const PAGE_SIZE = 15

interface Filters {
  dateFrom: string
  dateTo: string
  tipo: '' | 'COMPRA' | 'VENTA'
}

export default function HistorialPage() {
  const supabase = createBrowserSupabaseClient()
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
        'Ganancia COP': tx.tipo === 'VENTA' ? Number(tx.ganancia_cop ?? 0) : '',
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 text-[13px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-black">Historial</h1>
          <p className="text-[11px] text-slate-600">{total.toLocaleString('es-CO')} operaciones</p>
        </div>
        <button
          type="button"
          disabled={exporting || total === 0}
          onClick={() => void exportarExcel()}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-md border border-sky-600 bg-sky-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          {exporting ? 'Exportando…' : 'Exportar a Excel'}
        </button>
      </header>

      <div className="card-pro border border-slate-100 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-[11px] font-medium text-slate-600">Filtros</span>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-black"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label className="label text-[11px]">Desde</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
                setPage(1)
              }}
              className="input-field min-h-[36px] text-[13px]"
            />
          </div>
          <div>
            <label className="label text-[11px]">Hasta</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
                setPage(1)
              }}
              className="input-field min-h-[36px] text-[13px]"
            />
          </div>
          <div>
            <label className="label text-[11px]">Tipo</label>
            <select
              value={filters.tipo}
              onChange={(e) => {
                setFilters((f) => ({
                  ...f,
                  tipo: e.target.value as Filters['tipo'],
                }))
                setPage(1)
              }}
              className="input-field min-h-[36px] text-[13px]"
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
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100">
                <th className="table-header">#</th>
                <th className="table-header">Fecha</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Divisa</th>
                <th className="table-header text-right">Monto</th>
                <th className="table-header text-right">Tasa</th>
                <th className="table-header text-right">Total COP</th>
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
                rows.map((tx, idx) => (
                  <tr key={tx.id} className="table-row-striped hover:bg-slate-50/80">
                    <td className="table-cell text-[11px] text-slate-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="table-cell text-[11px] text-slate-700">{formatDate(tx.fecha)}</td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                          tx.tipo === 'COMPRA'
                            ? 'border-slate-100 bg-slate-50 text-slate-800'
                            : 'border-slate-100 bg-white text-slate-800'
                        }`}
                      >
                        {tx.tipo === 'COMPRA' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {tx.tipo}
                      </span>
                    </td>
                    <td className="table-cell font-medium">{tx.moneda}</td>
                    <td className="table-cell text-right font-mono">{formatMilesEs(Number(tx.monto_divisa), 4)}</td>
                    <td className="table-cell text-right font-mono text-[11px]">{formatMilesEs(tx.tasa_aplicada, 2)}</td>
                    <td className="table-cell text-right font-mono font-medium">{formatCOP(tx.total_cop)}</td>
                    <td className="table-cell text-[11px]">{tx.metodo_pago ?? 'Efectivo'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
            <p className="text-[11px] text-slate-600">
              Página {page} / {totalPages} · {total} resultados
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-100 bg-white text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
