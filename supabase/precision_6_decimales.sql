-- Alta precisión (6 decimales) para evitar pérdidas por redondeo.
-- Ejecutar en Supabase SQL Editor. Idempotente en la medida de lo posible.

-- IMPORTANTE:
-- Si existe la vista `public.vista_ultimo_cierre`, hay que dropearla antes de alterar tipos
-- en `public.cierres_diarios` (p.ej. `cierre_manual`), y recrearla al final.
DROP VIEW IF EXISTS public.vista_ultimo_cierre;
DROP VIEW IF EXISTS public.vista_inventario_inicial;

-- Transacciones
ALTER TABLE public.transacciones
  ALTER COLUMN monto_divisa TYPE NUMERIC(20, 6),
  ALTER COLUMN tasa_aplicada TYPE NUMERIC(20, 6),
  ALTER COLUMN total_cop TYPE NUMERIC(20, 6);

-- Cierres diarios (auditoría)
ALTER TABLE public.cierres_diarios
  ALTER COLUMN apertura TYPE NUMERIC(20, 6),
  ALTER COLUMN cierre_manual TYPE NUMERIC(20, 6),
  ALTER COLUMN cierre_estimado TYPE NUMERIC(20, 6),
  ALTER COLUMN ganancia_calculada TYPE NUMERIC(20, 6),
  ALTER COLUMN promedio_compra TYPE NUMERIC(20, 6),
  ALTER COLUMN promedio_compra_acumulado TYPE NUMERIC(20, 6),
  ALTER COLUMN promedio_anterior TYPE NUMERIC(20, 6),
  ALTER COLUMN total_comprado_divisa TYPE NUMERIC(20, 6),
  ALTER COLUMN total_vendido_divisa TYPE NUMERIC(20, 6);

-- Columnas adicionales si existen (scripts incrementales previos)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cierres_diarios' AND column_name='total_comprado_dia'
  ) THEN
    EXECUTE 'ALTER TABLE public.cierres_diarios ALTER COLUMN total_comprado_dia TYPE NUMERIC(20, 6)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cierres_diarios' AND column_name='total_vendido_dia'
  ) THEN
    EXECUTE 'ALTER TABLE public.cierres_diarios ALTER COLUMN total_vendido_dia TYPE NUMERIC(20, 6)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cierres_diarios' AND column_name='promedio_venta'
  ) THEN
    EXECUTE 'ALTER TABLE public.cierres_diarios ALTER COLUMN promedio_venta TYPE NUMERIC(20, 6)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cierres_diarios' AND column_name='promedio_venta_dia'
  ) THEN
    EXECUTE 'ALTER TABLE public.cierres_diarios ALTER COLUMN promedio_venta_dia TYPE NUMERIC(20, 6)';
  END IF;
END $$;

-- Caja / deudas / gastos
ALTER TABLE public.caja_diaria ALTER COLUMN monto TYPE NUMERIC(20, 6);
ALTER TABLE public.deudas ALTER COLUMN monto TYPE NUMERIC(20, 6);
ALTER TABLE public.gastos ALTER COLUMN monto_cop TYPE NUMERIC(20, 6);

-- Tengo: arqueo por divisa
ALTER TABLE public.arqueo_tengo
  ALTER COLUMN cantidad TYPE NUMERIC(20, 6),
  ALTER COLUMN precio_compra TYPE NUMERIC(20, 6);

-- TRM de mercado
ALTER TABLE public.trm_mercado ALTER COLUMN valor_cop TYPE NUMERIC(20, 6);

-- Snapshot de balances
ALTER TABLE public.balances_diarios
  ALTER COLUMN tengo_total TYPE NUMERIC(20, 6),
  ALTER COLUMN debo_tener_total TYPE NUMERIC(20, 6),
  ALTER COLUMN ganancias_dia TYPE NUMERIC(20, 6),
  ALTER COLUMN gastos_dia TYPE NUMERIC(20, 6),
  ALTER COLUMN me_deben_total TYPE NUMERIC(20, 6),
  ALTER COLUMN debo_total TYPE NUMERIC(20, 6);

-- Recrear vista de último cierre (si la usas para auditoría/arrastre).
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

-- Recrear vista para inventario inicial (si la usas).
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

