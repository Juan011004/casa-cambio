-- Tabla caché TRM (referencia de mercado). Ejecutar en Supabase SQL Editor.
-- La app lee desde aquí; el cron / server action actualiza vía service role.

CREATE TABLE IF NOT EXISTS public.trm_mercado (
    codigo TEXT PRIMARY KEY,
    nombre TEXT,
    valor_cop DECIMAL(15, 2) NOT NULL,
    ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.trm_mercado (codigo, nombre, valor_cop) VALUES
('USD', 'Dólar', 3900),
('EUR', 'Euro', 4200),
('GBP', 'Libra', 4900),
('BRL', 'Real', 780),
('MXN', 'Peso MX', 230),
('CAD', 'Dólar CAN', 2850),
('CLP', 'Peso CHI', 4.2),
('PEN', 'Sol', 1050),
('ARS', 'Peso ARG', 4.5),
('AUD', 'Dólar AUS', 2550),
('OTRO', 'Otra divisa', 3900)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.trm_mercado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trm_mercado_select_auth ON public.trm_mercado;
CREATE POLICY trm_mercado_select_auth ON public.trm_mercado
  FOR SELECT TO authenticated
  USING (true);
