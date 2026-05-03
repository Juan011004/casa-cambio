-- Cierre diario simplificado (5 columnas de negocio + metadatos).
-- Ejecutar en Supabase SQL Editor. Requiere public.divisas(codigo).

ALTER TABLE public.transacciones DROP COLUMN IF EXISTS ganancia_cop;

DROP TABLE IF EXISTS public.cierres_diarios CASCADE;

CREATE TABLE public.cierres_diarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    moneda TEXT NOT NULL REFERENCES public.divisas(codigo),
    apertura NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cierre_manual NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cierre_estimado NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ganancia_calculada NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, fecha, moneda)
);

CREATE INDEX IF NOT EXISTS idx_cierres_fecha_user ON public.cierres_diarios (usuario_id, fecha DESC);

ALTER TABLE public.cierres_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cierres_diarios_tenant ON public.cierres_diarios;
CREATE POLICY cierres_diarios_tenant ON public.cierres_diarios
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
