-- Ganancia total del día (COP) forzada para un usuario/fecha. Afecta `balances_diarios.ganancias_dia` y la cadena de "Debo tener".
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.ganancia_dia_override (
  usuario_id uuid NOT NULL,
  fecha date NOT NULL,
  ganancia_cop numeric(20, 2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ganancia_dia_override_pkey PRIMARY KEY (usuario_id, fecha)
);

ALTER TABLE public.ganancia_dia_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ganancia_dia_override_tenant ON public.ganancia_dia_override;
CREATE POLICY ganancia_dia_override_tenant ON public.ganancia_dia_override
  FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);
