-- v7: Inventario consolidado por (usuario_id, divisa) + triggers en transacciones y deudas.
-- EJECUTAR EN ORDEN en Supabase SQL Editor (hacer backup si hay datos en inventario).

DROP TRIGGER IF EXISTS trg_actualizar_stock_transacciones ON public.transacciones;
DROP TRIGGER IF EXISTS trg_actualizar_stock_deudas ON public.deudas;

DROP TABLE IF EXISTS public.inventario CASCADE;

CREATE TABLE public.inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    divisa TEXT NOT NULL REFERENCES public.divisas(codigo),
    cantidad_actual NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ultima_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, divisa)
);

CREATE INDEX IF NOT EXISTS idx_inventario_usuario_divisa ON public.inventario (usuario_id, divisa);

ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventario_tenant ON public.inventario;
CREATE POLICY inventario_tenant ON public.inventario
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.actualizar_stock_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  delta NUMERIC(15, 2);
BEGIN
  IF TG_TABLE_NAME = 'transacciones' THEN
    IF NEW.usuario_id IS NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.tipo = 'COMPRA' THEN
      INSERT INTO public.inventario (usuario_id, divisa, cantidad_actual, ultima_actualizacion)
      VALUES (NEW.usuario_id, NEW.moneda, NEW.monto_divisa, NOW())
      ON CONFLICT (usuario_id, divisa) DO UPDATE SET
        cantidad_actual = public.inventario.cantidad_actual + EXCLUDED.cantidad_actual,
        ultima_actualizacion = NOW();
    ELSIF NEW.tipo = 'VENTA' THEN
      INSERT INTO public.inventario (usuario_id, divisa, cantidad_actual, ultima_actualizacion)
      VALUES (NEW.usuario_id, NEW.moneda, -NEW.monto_divisa, NOW())
      ON CONFLICT (usuario_id, divisa) DO UPDATE SET
        cantidad_actual = public.inventario.cantidad_actual + EXCLUDED.cantidad_actual,
        ultima_actualizacion = NOW();
    END IF;

  ELSIF TG_TABLE_NAME = 'deudas' THEN
    IF NEW.usuario_id IS NULL OR NEW.divisa = 'COP' THEN
      RETURN NEW;
    END IF;
    IF NEW.tipo = 'DEBEN' THEN
      delta := -NEW.monto;
    ELSIF NEW.tipo = 'DEBO' THEN
      delta := NEW.monto;
    ELSE
      RETURN NEW;
    END IF;
    INSERT INTO public.inventario (usuario_id, divisa, cantidad_actual, ultima_actualizacion)
    VALUES (NEW.usuario_id, NEW.divisa, delta, NOW())
    ON CONFLICT (usuario_id, divisa) DO UPDATE SET
      cantidad_actual = public.inventario.cantidad_actual + EXCLUDED.cantidad_actual,
      ultima_actualizacion = NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_actualizar_stock_transacciones
  AFTER INSERT ON public.transacciones
  FOR EACH ROW
  EXECUTE FUNCTION public.actualizar_stock_inventario();

CREATE TRIGGER trg_actualizar_stock_deudas
  AFTER INSERT ON public.deudas
  FOR EACH ROW
  EXECUTE FUNCTION public.actualizar_stock_inventario();
