-- Auditoría de cierres diarios (promedios ponderados y arqueo).
-- Ejecutar en Supabase SQL Editor. Requiere public.divisas(codigo).

CREATE TABLE IF NOT EXISTS public.cierres_diarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    moneda TEXT NOT NULL REFERENCES public.divisas(codigo),

    monto_inicial NUMERIC(15, 2) NOT NULL DEFAULT 0,
    promedio_inicial NUMERIC(15, 2) NOT NULL DEFAULT 0,

    total_compra_monto NUMERIC(15, 2) NOT NULL DEFAULT 0,
    promedio_compra_dia NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_venta_monto NUMERIC(15, 2) NOT NULL DEFAULT 0,
    promedio_venta_dia NUMERIC(15, 2) NOT NULL DEFAULT 0,

    cierre_estimado_sistema NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cierre_manual_fisico NUMERIC(15, 2) NOT NULL DEFAULT 0,
    diferencia_arqueo NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ganancia_neta_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,

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
