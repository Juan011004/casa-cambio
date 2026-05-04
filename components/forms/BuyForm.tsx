'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Calculator } from 'lucide-react'
import { toast } from 'sonner'
import { parseFlexibleNumber } from '@/lib/parseMoney'
import { totalCopFromTasa } from '@/lib/pricing'
import { registrarCompra } from '@/app/actions/transactions'
import { formatCOP } from '@/lib/utils'
import { useDivisasMaestro } from '@/hooks/useDivisasMaestro'
import { DIVISAS_FALLBACK } from '@/lib/divisasCatalog'
import { errorMessage } from '@/lib/errorMessage'
import { MoneyTextField } from '@/components/forms/MoneyTextField'
import type { MetodoPago } from '@/types/database'

const buySchema = z.object({
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
    }, { message: 'Indique el precio de compra' }),
  metodo_pago: z.enum(['Efectivo', 'Nequi', 'Cheque']),
})

type BuyFormData = z.infer<typeof buySchema>

const METODOS: MetodoPago[] = ['Efectivo', 'Nequi', 'Cheque']

export default function BuyForm() {
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
  } = useForm<BuyFormData>({
    resolver: zodResolver(buySchema),
    defaultValues: { divisa: 'USD', cantidad: '', precio: '', metodo_pago: 'Efectivo' },
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  })

  const cantidadStr = watch('cantidad')
  const precioStr = watch('precio')
  const cantidad = parseFlexibleNumber(cantidadStr || '')
  const tasa = parseFlexibleNumber(precioStr || '')
  const totalCOP = totalCopFromTasa(cantidad, tasa)

  const onSubmit = async (data: BuyFormData) => {
    setLoading(true)
    try {
      const res = await registrarCompra({
        divisa: data.divisa,
        cantidad: parseFlexibleNumber(data.cantidad),
        tasa: parseFlexibleNumber(data.precio),
        metodo_pago: data.metodo_pago,
      })
      if (!res.ok) {
        toast.error('No se registró la compra', { description: res.error })
        return
      }
      toast.success('Compra registrada')
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
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card-pro space-y-3 p-4 text-base text-black">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="divisa-c">
              Divisa
            </label>
            <select id="divisa-c" {...register('divisa')} className="input-field min-h-[48px] py-2.5 text-base">
              {opciones.map((d) => (
                <option key={d.codigo} value={d.codigo}>
                  {byLabel[d.codigo] ? `${d.codigo} — ${byLabel[d.codigo]}` : d.codigo}
                </option>
              ))}
            </select>
            {errors.divisa ? <p className="mt-0.5 text-xs text-red-700">{errors.divisa.message}</p> : null}
          </div>

          <MoneyTextField
            id="cant-c"
            label="Cantidad"
            maxFrac={4}
            value={watch('cantidad')}
            onChange={(v) => setValue('cantidad', v, { shouldValidate: false })}
          />
          {errors.cantidad ? <p className="mt-0.5 text-xs text-red-700">{errors.cantidad.message}</p> : null}

          <MoneyTextField
            id="precio-c"
            label="Precio de compra"
            maxFrac={2}
            value={watch('precio')}
            onChange={(v) => setValue('precio', v, { shouldValidate: false })}
          />
          {errors.precio ? <p className="mt-0.5 text-xs text-red-700">{errors.precio.message}</p> : null}

          <div>
            <label className="label" htmlFor="pago-c">
              Método de pago
            </label>
            <select id="pago-c" {...register('metodo_pago')} className="input-field min-h-[48px] py-2.5 text-base">
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
            <div className="flex min-h-[48px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <Calculator className="h-4 w-4 shrink-0 text-blue-700" />
              <span className="text-base font-semibold text-black">{totalCOP > 0 ? formatCOP(totalCOP) : '—'}</span>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary mt-1 min-h-[48px] w-full text-base font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar compra'}
        </button>
      </form>
    </section>
  )
}
