-- Incremental: promedios en cierres, índice por fecha, política UPDATE en transacciones.
-- Ejecutar en Supabase SQL Editor (idempotente).

ALTER TABLE public.cierres_diarios
  ADD COLUMN IF NOT EXISTS promedio_compra NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promedio_venta NUMERIC(15, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cierres_diarios_fecha ON public.cierres_diarios (fecha DESC);

DROP POLICY IF EXISTS "Usuarios pueden editar sus propias transacciones" ON public.transacciones;
CREATE POLICY "Usuarios pueden editar sus propias transacciones"
  ON public.transacciones
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);
