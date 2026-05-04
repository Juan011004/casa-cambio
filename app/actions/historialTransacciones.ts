'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import type { ActionResult } from '@/types/database'
import { historialTransaccionesLoteSchema } from '@/lib/validation/schemas'
import { logServerError } from '@/lib/server/server-log'
import { totalCopFromTasa } from '@/lib/pricing'

export async function actualizarTransaccionesHistorial(raw: unknown): Promise<ActionResult> {
  const parsed = historialTransaccionesLoteSchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    const issues = flat.formErrors.concat(
      Object.values(flat.fieldErrors).flat().filter((x): x is string => typeof x === 'string')
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

    for (const row of parsed.data) {
      const total_cop = totalCopFromTasa(row.monto_divisa, row.tasa_aplicada)
      if (total_cop <= 0) {
        return { ok: false, error: `Total COP inválido para la fila ${row.id}.` }
      }

      const { error } = await supabase
        .from('transacciones')
        .update({
          tipo: row.tipo,
          moneda: row.moneda,
          monto_divisa: row.monto_divisa,
          tasa_aplicada: row.tasa_aplicada,
          total_cop,
          metodo_pago: row.metodo_pago,
        })
        .eq('id', row.id)
        .eq('usuario_id', user.id)

      if (error) {
        logServerError('actualizarTransaccionesHistorial/update', new Error(error.message))
        return { ok: false, error: 'No se pudo guardar un registro.' }
      }
    }

    revalidatePath('/historial')
    revalidatePath('/dashboard')
    revalidatePath('/caja')
    revalidatePath('/inventory')
    return { ok: true }
  } catch (e) {
    logServerError('actualizarTransaccionesHistorial', e)
    return { ok: false, error: 'Error inesperado.' }
  }
}
