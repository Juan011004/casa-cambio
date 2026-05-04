-- Auditoría de cierres + origen (operativo / carga inicial). Ejecutar en Supabase SQL Editor.

ALTER TABLE public.cierres_diarios
  ADD COLUMN IF NOT EXISTS promedio_anterior NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_comprado_divisa NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_vendido_divisa NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'OPERATIVO';

ALTER TABLE public.cierres_diarios DROP CONSTRAINT IF EXISTS cierres_diarios_origen_check;
ALTER TABLE public.cierres_diarios ADD CONSTRAINT cierres_diarios_origen_check
  CHECK (origen IN ('OPERATIVO', 'CARGA_INICIAL'));

CREATE OR REPLACE VIEW public.vista_ultimo_cierre AS
SELECT DISTINCT ON (usuario_id, moneda)
    usuario_id,
    moneda,
    fecha,
    cierre_manual AS saldo_anterior,
    COALESCE(
      NULLIF(promedio_compra_acumulado, 0::numeric),
      promedio_compra
    ) AS promedio_anterior
FROM public.cierres_diarios
ORDER BY usuario_id, moneda, fecha DESC;

ALTER VIEW public.vista_ultimo_cierre SET (security_invoker = true);

GRANT SELECT ON public.vista_ultimo_cierre TO authenticated;
