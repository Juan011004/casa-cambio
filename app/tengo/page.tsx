'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/browser-client'
import { upsertArqueoTengo, eliminarArqueoTengo } from '@/app/actions/arqueoTengo'
import { formatCOP, formatMilesEs, fechaLocalYYYYMMDD } from '@/lib/utils'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { errorMessage } from '@/lib/errorMessage'

type ArqueoRow = {
  id: string
  moneda_codigo: string
  moneda_nombre: string
  cantidad: number
  precio_compra: number
  fecha: string
}

export default function TengoPage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { rows: divisasMaestro } = useDivisasMaestro()
  const divisas = useMemo(() => (divisasMaestro.length ? divisasMaestro : DIVISAS_FALLBACK), [divisasMaestro])

  const [loading, setLoading] = useState(true)
  const [arqueo, setArqueo] = useState<ArqueoRow[]>([])

  const [arqCodigo, setArqCodigo] = useState('USD')
  const [arqCantidad, setArqCantidad] = useState('')
  const [arqPrecio, setArqPrecio] = useState('')
  const [arqGuardando, setArqGuardando] = useState(false)

  const [editArqueoId, setEditArqueoId] = useState<string | null>(null)
  const [draftCantidad, setDraftCantidad] = useState('')
  const [draftPrecio, setDraftPrecio] = useState('')
  const [savingArqueo, setSavingArqueo] = useState(false)

  const [elimArqueo, setElimArqueo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setArqueo([])
      setLoading(false)
      return
    }

    const qRes = await supabase
      .from('arqueo_tengo')
      .select('id,moneda_codigo,moneda_nombre,cantidad,precio_compra,fecha')
      .eq('usuario_id', user.id)
      .order('moneda_codigo')

    setArqueo((qRes.error ? [] : qRes.data) as ArqueoRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const hoy = useMemo(() => fechaLocalYYYYMMDD(), [])

  const totalValoracionCop = useMemo(
    () => arqueo.reduce((s, r) => s + Number(r.cantidad) * Number(r.precio_compra), 0),
    [arqueo]
  )

  const onCrearArqueo = async (e: React.FormEvent) => {
    e.preventDefault()
    const div = divisas.find((d) => d.codigo === arqCodigo)
    const cant = parseFlexibleNumber(arqCantidad)
    const prec = parseFlexibleNumber(arqPrecio)
    if (!div) {
      toast.error('Seleccione una moneda.')
      return
    }
    if (!Number.isFinite(cant) || cant <= 0) {
      toast.error('Indique la cantidad.')
      return
    }
    if (!Number.isFinite(prec) || prec < 0) {
      toast.error('Indique el precio de compra (COP por unidad).')
      return
    }
    setArqGuardando(true)
    try {
      const res = await upsertArqueoTengo({
        moneda_codigo: div.codigo,
        moneda_nombre: div.nombre_completo ?? div.codigo,
        cantidad: cant,
        precio_compra: prec,
        fecha: hoy,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Arqueo guardado')
      setArqCantidad('')
      setArqPrecio('')
      await cargar()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setArqGuardando(false)
    }
  }

  const startEditArqueo = (r: ArqueoRow) => {
    setEditArqueoId(r.id)
    setDraftCantidad(r.cantidad !== 0 ? formatMilesEs(r.cantidad, 2) : '')
    setDraftPrecio(r.precio_compra !== 0 ? formatMilesEs(r.precio_compra, 2) : '')
  }

  const cancelEditArqueo = () => {
    setEditArqueoId(null)
    setDraftCantidad('')
    setDraftPrecio('')
  }

  const saveEditArqueo = async (r: ArqueoRow) => {
    const cant = parseFlexibleNumber(draftCantidad)
    const prec = parseFlexibleNumber(draftPrecio)
    if (!Number.isFinite(cant) || cant <= 0) {
      toast.error('Cantidad inválida.')
      return
    }
    if (!Number.isFinite(prec) || prec < 0) {
      toast.error('Precio inválido.')
      return
    }
    setSavingArqueo(true)
    try {
      const res = await upsertArqueoTengo({
        id: r.id,
        moneda_codigo: r.moneda_codigo,
        moneda_nombre: r.moneda_nombre,
        cantidad: cant,
        precio_compra: prec,
        fecha: r.fecha.slice(0, 10),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Actualizado')
      cancelEditArqueo()
      await cargar()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setSavingArqueo(false)
    }
  }

  const onEliminarArqueo = async (id: string) => {
    setElimArqueo(id)
    try {
      const res = await eliminarArqueoTengo({ id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      await cargar()
    } catch (err: unknown) {
      toast.error(errorMessage(err))
    } finally {
      setElimArqueo(null)
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 text-base text-black">
      <section className="overflow-hidden rounded-xl border border-slate-200 border-l-[4px] border-l-sky-600 bg-white shadow-md">
        <form onSubmit={(e) => void onCrearArqueo(e)} className="border-b border-slate-100 p-4">
          <div className="grid gap-4 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-4">
              <label className="label text-base" htmlFor="arq-div">
                Moneda
              </label>
              <select
                id="arq-div"
                className="input-field min-h-[48px] px-3 py-2.5 text-base"
                value={arqCodigo}
                onChange={(e) => setArqCodigo(e.target.value)}
              >
                {divisas.map((d) => (
                  <option key={d.codigo} value={d.codigo}>
                    {d.codigo} — {d.nombre_completo ?? d.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <MoneyTextField
                id="arq-cant"
                label="Cantidad"
                maxFrac={4}
                value={arqCantidad}
                onChange={setArqCantidad}
                inputClassName="input-field input-numeric min-h-[48px] px-3 py-2.5 text-base"
              />
            </div>
            <div className="sm:col-span-3">
              <MoneyTextField
                id="arq-precio"
                label="Precio compra (COP/unidad)"
                maxFrac={2}
                value={arqPrecio}
                onChange={setArqPrecio}
                inputClassName="input-field input-numeric min-h-[48px] px-3 py-2.5 text-base"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={arqGuardando}
                className="btn-primary mt-6 min-h-[48px] w-full justify-center text-base font-semibold sm:mt-8"
              >
                {arqGuardando ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[720px] border-collapse text-left text-base">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-3 font-semibold text-slate-800">Moneda</th>
                <th className="px-3 py-3 font-semibold text-slate-800">Nombre</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-800">Cantidad</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-800">Precio compra</th>
                <th className="px-3 py-3 text-right font-semibold text-slate-800">Valor COP</th>
                <th className="w-28 px-2 py-3 text-center font-semibold text-slate-800">Editar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    …
                  </td>
                </tr>
              ) : arqueo.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    Sin arqueo de divisas.
                  </td>
                </tr>
              ) : (
                arqueo.map((r) => {
                  const valorCop = Number(r.cantidad) * Number(r.precio_compra)
                  return editArqueoId === r.id ? (
                    <tr key={r.id} className="border-b border-slate-100 bg-sky-50/40">
                      <td className="px-3 py-2 align-middle font-semibold">{r.moneda_codigo}</td>
                      <td className="px-3 py-2 align-middle text-sm text-slate-700">{r.moneda_nombre}</td>
                      <td className="px-3 py-2 align-middle">
                        <MoneyTextField
                          id={`qc-${r.id}`}
                          label=""
                          omitLabel
                          maxFrac={4}
                          value={draftCantidad}
                          onChange={setDraftCantidad}
                          inputClassName="input-field input-numeric min-h-[44px] text-base"
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <MoneyTextField
                          id={`qp-${r.id}`}
                          label=""
                          omitLabel
                          maxFrac={2}
                          value={draftPrecio}
                          onChange={setDraftPrecio}
                          inputClassName="input-field input-numeric min-h-[44px] text-base"
                        />
                      </td>
                      <td className="px-3 py-2 align-middle text-right font-mono text-sm text-slate-500">—</td>
                      <td className="px-2 py-2 align-middle">
                        <div className="flex justify-center gap-1">
                          <button
                            type="button"
                            disabled={savingArqueo}
                            onClick={() => void saveEditArqueo(r)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                          >
                            {savingArqueo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                          </button>
                          <button
                            type="button"
                            disabled={savingArqueo}
                            onClick={cancelEditArqueo}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-bold text-slate-900">{r.moneda_codigo}</td>
                      <td className="px-3 py-3 text-slate-700">{r.moneda_nombre}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatMilesEs(Number(r.cantidad), 4)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatMilesEs(Number(r.precio_compra), 2)}</td>
                      <td className="px-3 py-3 text-right font-mono text-lg font-semibold tabular-nums">{formatCOP(valorCop)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditArqueo(r)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            disabled={elimArqueo === r.id}
                            onClick={() => void onEliminarArqueo(r.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          >
                            {elimArqueo === r.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {!loading && arqueo.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={4} className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-700">
                    Valoración total (COP)
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-3xl font-bold tabular-nums text-slate-900">
                    {formatCOP(totalValoracionCop)}
                  </td>
                  <td className="bg-slate-50" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </main>
  )
}
