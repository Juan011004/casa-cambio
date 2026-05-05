-- Snapshot diario de balances (backup al cierre). Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.balances_diarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,

    tengo_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    debo_tener_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ganancias_dia NUMERIC(15, 2) NOT NULL DEFAULT 0,
    gastos_dia NUMERIC(15, 2) NOT NULL DEFAULT 0,

    me_deben_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    debo_total NUMERIC(15, 2) NOT NULL DEFAULT 0,

    detalle_arqueo JSONB,
    detalle_deudas JSONB,
    detalle_tarjetas JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (usuario_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_balances_diarios_user_fecha ON public.balances_diarios (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_balances_fecha ON public.balances_diarios (fecha DESC);

ALTER TABLE public.balances_diarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS balances_diarios_tenant ON public.balances_diarios;
CREATE POLICY balances_diarios_tenant ON public.balances_diarios
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
