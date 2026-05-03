-- Reestructuración v5: multitenancy estricto + RLS (ejecutar en Supabase SQL Editor después de v4)
-- Requiere al menos un usuario en auth.users para backfill de inventario sin usuario_id.

-- 1) Transacciones: cajero_id → usuario_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transacciones' AND column_name = 'cajero_id'
  ) THEN
    ALTER TABLE public.transacciones RENAME COLUMN cajero_id TO usuario_id;
  END IF;
END $$;

-- 2) Inventario por usuario
ALTER TABLE public.inventario ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES auth.users(id);

UPDATE public.inventario i
SET usuario_id = u.id
FROM (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1) u
WHERE i.usuario_id IS NULL;

ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS inventario_divisa_denominacion_key;
ALTER TABLE public.inventario DROP CONSTRAINT IF EXISTS inventario_usuario_divisa_denominacion_key;

DELETE FROM public.inventario a
USING public.inventario b
WHERE a.ctid < b.ctid
  AND a.usuario_id IS NOT DISTINCT FROM b.usuario_id
  AND a.divisa = b.divisa
  AND a.denominacion = b.denominacion;

ALTER TABLE public.inventario
  ADD CONSTRAINT inventario_usuario_divisa_denominacion_key
  UNIQUE (usuario_id, divisa, denominacion);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventario WHERE usuario_id IS NULL) THEN
    ALTER TABLE public.inventario ALTER COLUMN usuario_id SET NOT NULL;
  END IF;
END $$;

-- 3) Helper admin (SECURITY DEFINER evita recursión en políticas de usuarios)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid() AND u.rol = 'admin'
  );
$$;

-- 4) RLS: limpiar políticas permisivas previas y aplicar aislamiento

ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transacciones_isolation ON public.transacciones;
DROP POLICY IF EXISTS transacciones_tenant ON public.transacciones;
CREATE POLICY transacciones_tenant ON public.transacciones
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gastos_isolation ON public.gastos;
DROP POLICY IF EXISTS gastos_tenant ON public.gastos;
CREATE POLICY gastos_tenant ON public.gastos
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

ALTER TABLE public.caja_diaria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS caja_diaria_all ON public.caja_diaria;
DROP POLICY IF EXISTS caja_diaria_isolation ON public.caja_diaria;
DROP POLICY IF EXISTS caja_diaria_tenant ON public.caja_diaria;
CREATE POLICY caja_diaria_tenant ON public.caja_diaria
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventario_isolation ON public.inventario;
DROP POLICY IF EXISTS inventario_tenant ON public.inventario;
CREATE POLICY inventario_tenant ON public.inventario
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

ALTER TABLE public.deudas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deudas_isolation ON public.deudas;
DROP POLICY IF EXISTS deudas_tenant ON public.deudas;
CREATE POLICY deudas_tenant ON public.deudas
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

ALTER TABLE public.divisas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS divisas_isolation ON public.divisas;
DROP POLICY IF EXISTS divisas_read_all ON public.divisas;
DROP POLICY IF EXISTS divisas_select_all ON public.divisas;
CREATE POLICY divisas_select_all ON public.divisas
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.registro_trm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registro_trm_isolation ON public.registro_trm;
DROP POLICY IF EXISTS registro_trm_read ON public.registro_trm;
CREATE POLICY registro_trm_read ON public.registro_trm
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usuarios_isolation ON public.usuarios;
DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update ON public.usuarios;
DROP POLICY IF EXISTS usuarios_insert_own ON public.usuarios;

CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY usuarios_insert_own ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY usuarios_update ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());
