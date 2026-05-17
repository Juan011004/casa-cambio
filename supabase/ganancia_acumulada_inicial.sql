-- Ganancia acumulada (COP) que el negocio ya llevaba antes de registrar días en la app.
-- Se suma al acumulado del dashboard (cierres + balances con overrides).

CREATE TABLE IF NOT EXISTS public.ganancia_acumulada_inicial (
  usuario_id uuid PRIMARY KEY,
  monto_cop numeric(20, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ganancia_acumulada_inicial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ganancia_acumulada_inicial_tenant ON public.ganancia_acumulada_inicial;
CREATE POLICY ganancia_acumulada_inicial_tenant ON public.ganancia_acumulada_inicial
  FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);
