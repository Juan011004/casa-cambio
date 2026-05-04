-- Módulo Tengo: quitar cuenta de activos y crear arqueo de divisas.
-- Ejecutar en Supabase SQL Editor.

-- 1) Activos: solo concepto + valor (columna cuenta eliminada)
ALTER TABLE public.activos DROP COLUMN IF EXISTS cuenta;

-- 2) Arqueo personal de divisas (una fila por usuario y moneda)
CREATE TABLE IF NOT EXISTS public.arqueo_tengo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    moneda_codigo TEXT NOT NULL REFERENCES public.divisas(codigo),
    moneda_nombre TEXT NOT NULL,
    cantidad NUMERIC(15, 2) NOT NULL DEFAULT 0,
    precio_compra NUMERIC(15, 2) NOT NULL DEFAULT 0,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_arqueo_tengo_usuario_moneda UNIQUE (usuario_id, moneda_codigo)
);

CREATE INDEX IF NOT EXISTS idx_arqueo_tengo_usuario ON public.arqueo_tengo(usuario_id);

ALTER TABLE public.arqueo_tengo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arqueo_tengo_tenant ON public.arqueo_tengo;
CREATE POLICY arqueo_tengo_tenant ON public.arqueo_tengo
  FOR ALL TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());
