import { z } from 'zod'
import { safeDivisaCode, safePlainText } from '@/lib/validation/sanitize'

const moneyMax = 1e15

export const metodoPagoSchema = z.enum(['Efectivo', 'Nequi', 'Cheque'])

export const transaccionCompraVentaSchema = z.object({
  divisa: z
    .string()
    .min(2, 'Divisa inválida')
    .max(12)
    .transform(safeDivisaCode)
    .refine((s) => s.length >= 2, { message: 'Divisa inválida' }),
  cantidad: z.coerce
    .number({ invalid_type_error: 'Cantidad inválida' })
    .positive('La cantidad debe ser mayor a 0')
    .max(moneyMax, 'Cantidad demasiado grande'),
  tasa: z.coerce
    .number({ invalid_type_error: 'Tasa inválida' })
    .positive('La tasa debe ser mayor a 0')
    .max(moneyMax, 'Tasa demasiado grande'),
  metodo_pago: metodoPagoSchema,
})

export const gastoInsertSchema = z.object({
  concepto: z
    .string()
    .min(1, 'Indique el concepto.')
    .max(200)
    .transform((s) => safePlainText(s, 200))
    .refine((s) => s.length > 0, { message: 'Indique el concepto.' }),
  monto_cop: z.coerce
    .number({ invalid_type_error: 'Monto inválido' })
    .positive('El monto debe ser mayor a 0')
    .max(moneyMax, 'Monto demasiado grande'),
})

export const deudaRegistroSchema = z.object({
  tipo: z.enum(['DEBEN', 'DEBO']),
  responsable: z
    .string()
    .min(1, 'Escriba el nombre o referencia.')
    .max(120)
    .transform((s) => safePlainText(s, 120))
    .refine((s) => s.length > 0, { message: 'Escriba el nombre o referencia.' }),
  divisa: z
    .string()
    .min(2)
    .max(12)
    .transform(safeDivisaCode)
    .refine((s) => s.length >= 2, { message: 'Divisa inválida' }),
  monto: z.coerce
    .number({ invalid_type_error: 'Monto inválido' })
    .positive('El monto debe ser mayor a 0')
    .max(moneyMax, 'Monto demasiado grande'),
})

export const uuidSchema = z.string().uuid('Identificador inválido.')

export const cajaGuardarSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  tipo: z.enum(['APERTURA', 'CIERRE']),
  montos: z
    .record(z.string(), z.number().finite().min(0, 'Montos no negativos').max(moneyMax))
    .superRefine((val, ctx) => {
      const keys = Object.keys(val)
      if (keys.length > 40) {
        ctx.addIssue({ code: 'custom', message: 'Demasiadas monedas en el formulario' })
      }
      for (const k of keys) {
        if (!/^[A-Z0-9_]{1,12}$/i.test(k)) {
          ctx.addIssue({ code: 'custom', message: 'Código de moneda inválido' })
          break
        }
      }
    }),
})

/** Cierre físico: montos contados por código de moneda. */
export const finalizarCierreSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  manualCierre: z
    .record(z.string(), z.number().finite().min(0, 'Montos no negativos').max(moneyMax))
    .superRefine((val, ctx) => {
      const keys = Object.keys(val)
      if (keys.length > 40) ctx.addIssue({ code: 'custom', message: 'Demasiadas monedas' })
      for (const k of keys) {
        if (!/^[A-Z0-9_]{1,12}$/i.test(k)) {
          ctx.addIssue({ code: 'custom', message: 'Código de moneda inválido' })
          break
        }
      }
    }),
})
