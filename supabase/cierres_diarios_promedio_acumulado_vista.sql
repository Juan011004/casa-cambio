-- Ejecutar en Supabase SQL Editor si ya existe `cierres_diarios`.
-- Promedio de compra acumulado (WAC) y vista del último cierre por usuario/moneda.

ALTER TABLE public.cierres_diarios
ADD COLUMN IF NOT EXISTS promedio_compra_acumulado NUMERIC(15, 2) NOT NULL DEFAULT 0;

-- Preferir también `cierres_diarios_auditoria_carga.sql` para columnas de auditoría y el mismo criterio de promedio.
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
