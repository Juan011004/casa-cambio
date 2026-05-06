-- Auditoría y limpieza (retroactiva)

-- 1) Campo de última modificación
ALTER TABLE public.balances_diarios
  ADD COLUMN IF NOT EXISTS ultima_modificacion TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2) Trigger para actualizar automáticamente
CREATE OR REPLACE FUNCTION public.update_ultima_modificacion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_modificacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_balances_modificacion ON public.balances_diarios;
CREATE TRIGGER tr_update_balances_modificacion
BEFORE UPDATE ON public.balances_diarios
FOR EACH ROW
EXECUTE FUNCTION public.update_ultima_modificacion();

-- 3) Limpieza del módulo Tengo (tabla anterior)
DROP TABLE IF EXISTS public.arqueo_tengo CASCADE;

