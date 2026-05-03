import type { InventarioItem } from '@/types/database'

/** COP total: cantidad de divisa × tasa COP por 1 unidad (precio compra o venta configurado). */
export function totalCopFromTasa(cantidad: number, tasaCopPorUnidad: number): number {
  const c = Number(cantidad)
  const t = Number(tasaCopPorUnidad)
  if (!Number.isFinite(c) || !Number.isFinite(t) || c <= 0 || t <= 0) return 0
  return c * t
}

/** Existencias en “cara” de la divisa: suma (unidades × denominación) por todas las filas. */
export function stockCaraDivisa(rows: InventarioItem[], divisa: string): number {
  let sum = 0
  for (const row of rows) {
    if (row.divisa === divisa) {
      const den = Number(row.denominacion)
      const units = Number(row.cantidad)
      if (Number.isFinite(den) && Number.isFinite(units)) sum += den * units
    }
  }
  return sum
}
