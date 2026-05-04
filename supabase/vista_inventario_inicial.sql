-- Punto de partida por moneda (último cierre) + gastos por usuario.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_gastos_usuario_fecha ON public.gastos (usuario_id, fecha DESC);

CREATE OR REPLACE VIEW public.vista_inventario_inicial AS
SELECT DISTINCT ON (usuario_id, moneda)
    usuario_id,
    moneda,
    fecha AS fecha_ultimo_cierre,
    cierre_manual AS cantidad_inicial,
    COALESCE(
      NULLIF(promedio_compra_acumulado, 0::numeric),
      promedio_compra
    ) AS promedio_anterior
FROM public.cierres_diarios
ORDER BY usuario_id, moneda, fecha DESC;

ALTER VIEW public.vista_inventario_inicial SET (security_invoker = true);

GRANT SELECT ON public.vista_inventario_inicial TO authenticated;
