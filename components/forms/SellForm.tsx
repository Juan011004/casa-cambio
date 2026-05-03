'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { formatCOP } from '@/lib/utils'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { totalCopFromTasa } from '@/lib/pricing'
import { registrarVenta } from '@/app/actions/transactions'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { errorMessage } from '@/lib/errorMessage'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import type { MetodoPago } from '@/types/database'

const sellSchema = z.object({
  divisa: z.string().min(2),
  cantidad: z
    .string()
    .min(1)
    .refine((v) => {
      const n = parseFlexibleNumber(v)
      return Number.isFinite(n) && n > 0
    }, { message: 'Cantidad mayor a 0' }),
  precio: z
    .string()
    .min(1)
    .refine((v) => {
      const n = parseFlexibleNumber(v)
      return Number.isFinite(n) && n > 0
    }, { message: 'Indique el precio de venta' }),
  metodo_pago: z.enum(['Efectivo', 'Nequi', 'Cheque']),
})

type SellFormData = z.infer<typeof sellSchema>

const METODOS: MetodoPago[] = ['Efectivo', 'Nequi', 'Cheque']

export default function SellForm() {
  const { rows } = useDivisasMaestro()
  const [loading, setLoading] = useState(false)

  const opciones = useMemo(() => (rows.length ? rows : DIVISAS_FALLBACK), [rows])

  const byLabel = useMemo(() => {
    const m: Record<string, string> = {}
    for (const r of opciones) m[r.codigo] = r.nombre_completo
    return m
  }, [opciones])

  const {
    register,
    handleSubmit,
    watch,
    reset,
    clearErrors,
    setValue,
    formState: { errors },
  } = useForm<SellFormData>({
    resolver: zodResolver(sellSchema),
    defaultValues: { divisa: 'USD', cantidad: '', precio: '', metodo_pago: 'Efectivo' },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  })

  const cantidadStr = watch('cantidad')
  const precioStr = watch('precio')
  const cantidad = parseFlexibleNumber(cantidadStr || '')
  const tasa = parseFlexibleNumber(precioStr || '')
  const totalCOP = totalCopFromTasa(cantidad, tasa)

  const onSubmit = async (data: SellFormData) => {
    setLoading(true)
    try {
      const res = await registrarVenta({
        divisa: data.divisa,
        cantidad: parseFlexibleNumber(data.cantidad),
        tasa: parseFlexibleNumber(data.precio),
        metodo_pago: data.metodo_pago,
      })
      if (!res.ok) {
        toast.error('No se registró la venta', { description: res.error })
        return
      }
      const r = res.data
      toast.success('Venta registrada', {
        description: r
          ? `${formatCOP(r.total_cop)} · Ganancia ${formatCOP(r.ganancia_cop)}`
          : formatCOP(totalCOP),
      })
      clearErrors()
      reset(
        { divisa: data.divisa, cantidad: '', precio: '', metodo_pago: 'Efectivo' },
        { keepErrors: false, keepDirty: false, keepTouched: false, keepIsSubmitted: false }
      )
    } catch (e: unknown) {
      toast.error(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card-pro space-y-3 p-3 text-sm text-black">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="divisa-v">
              Divisa
            </label>
            <select id="divisa-v" {...register('divisa')} className="input-field min-h-[38px] py-1.5 text-sm">
              {opciones.map((d) => (
                <option key={d.codigo} value={d.codigo}>
                  {byLabel[d.codigo] ? `${d.codigo} — ${byLabel[d.codigo]}` : d.codigo}
                </option>
              ))}
            </select>
            {errors.divisa ? <p className="mt-0.5 text-xs text-red-700">{errors.divisa.message}</p> : null}
          </div>

          <MoneyTextField
            id="cant-v"
            label="Cantidad"
            maxFrac={4}
            value={watch('cantidad')}
            onChange={(v) => setValue('cantidad', v, { shouldValidate: false })}
          />
          {errors.cantidad ? <p className="mt-0.5 text-xs text-red-700">{errors.cantidad.message}</p> : null}

          <MoneyTextField
            id="precio-v"
            label="Precio de venta"
            maxFrac={2}
            value={watch('precio')}
            onChange={(v) => setValue('precio', v, { shouldValidate: false })}
          />
          {errors.precio ? <p className="mt-0.5 text-xs text-red-700">{errors.precio.message}</p> : null}

          <div>
            <label className="label" htmlFor="pago-v">
              Método de pago
            </label>
            <select id="pago-v" {...register('metodo_pago')} className="input-field min-h-[38px] py-1.5 text-sm">
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {errors.metodo_pago ? <p className="mt-0.5 text-xs text-red-700">{errors.metodo_pago.message}</p> : null}
          </div>

          <div>
            <p className="label mb-0.5">Total COP</p>
            <div className="flex min-h-[38px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
              <Calculator className="h-4 w-4 shrink-0 text-blue-700" />
              <span className="text-sm font-semibold text-black">{totalCOP > 0 ? formatCOP(totalCOP) : '—'}</span>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary mt-1 min-h-[40px] w-full text-sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar venta'}
        </button>
      </form>
    </section>
  )
}
