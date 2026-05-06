-- Caja: precios de compra por día (para valorar cierre manual en COP).

CREATE TABLE IF NOT EXISTS public.caja_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  moneda TEXT NOT NULL,
  precio_compra NUMERIC(20, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_modificacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, fecha, moneda)
);

CREATE INDEX IF NOT EXISTS idx_caja_precios_user_fecha ON public.caja_precios (usuario_id, fecha DESC);

ALTER TABLE public.caja_precios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS caja_precios_tenant ON public.caja_precios;
CREATE POLICY caja_precios_tenant ON public.caja_precios
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_ultima_modificacion_caja_precios()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_modificacion = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_caja_precios_modificacion ON public.caja_precios;
CREATE TRIGGER tr_update_caja_precios_modificacion
BEFORE UPDATE ON public.caja_precios
FOR EACH ROW
EXECUTE FUNCTION public.update_ultima_modificacion_caja_precios();

