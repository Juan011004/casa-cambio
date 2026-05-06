-- Agrega total de Caja (COP) al snapshot diario para auditoría.
ALTER TABLE public.balances_diarios
  ADD COLUMN IF NOT EXISTS caja_total_cop NUMERIC(20, 6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_balances_diarios_user_fecha_caja
  ON public.balances_diarios (usuario_id, fecha DESC, caja_total_cop);

