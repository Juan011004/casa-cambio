-- Activos (Tengo), abonos a deudas, y columnas COP del día en cierres. Ejecutar en Supabase SQL Editor.

-- 1) Activos
CREATE TABLE IF NOT EXISTS public.activos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    concepto TEXT NOT NULL,
    valor_cop NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cuenta TEXT NOT NULL CHECK (cuenta IN ('EFECTIVO', 'NEQUI', 'DEUDA', 'OTROS')),
    fecha DATE NOT NULL DEFAULT (CURRENT_DATE),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activos_usuario ON public.activos (usuario_id, fecha DESC);

ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activos_tenant ON public.activos;
CREATE POLICY activos_tenant ON public.activos
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- 2) Pagos parciales de deudas
CREATE TABLE IF NOT EXISTS public.pagos_deudas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deuda_id UUID NOT NULL REFERENCES public.deudas(id) ON DELETE CASCADE,
    monto_pagado NUMERIC(15, 2) NOT NULL CHECK (monto_pagado > 0),
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_deudas_deuda ON public.pagos_deudas (deuda_id, fecha_pago DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_deudas_user ON public.pagos_deudas (usuario_id);

ALTER TABLE public.pagos_deudas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pagos_deudas_tenant ON public.pagos_deudas;
CREATE POLICY pagos_deudas_tenant ON public.pagos_deudas
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

-- 3) Cierres: totales del día en COP (además de cantidades en divisa)
ALTER TABLE public.cierres_diarios
  ADD COLUMN IF NOT EXISTS total_comprado_dia NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_vendido_dia NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promedio_venta_dia NUMERIC(15, 2) NOT NULL DEFAULT 0;
