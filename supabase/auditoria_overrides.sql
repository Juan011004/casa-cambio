-- Overrides manuales para auditoría/ganancia en Dashboard.
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.auditoria_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  fecha date NOT NULL,
  moneda text NOT NULL,
  cantidad_inicial numeric(20,6),
  promedio_anterior numeric(20,6),
  promedio_compra_hoy numeric(20,6),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auditoria_overrides_unique
  ON public.auditoria_overrides (usuario_id, fecha, moneda);

ALTER TABLE public.auditoria_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_overrides_tenant ON public.auditoria_overrides;
CREATE POLICY auditoria_overrides_tenant ON public.auditoria_overrides
  FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

