-- Esquema operativo v2 (ejecutar en Supabase SQL Editor)
-- Usa gen_random_uuid() (PostgreSQL 13+; disponible en Supabase sin extensión extra)

DROP TABLE IF EXISTS nos_deben CASCADE;
DROP TABLE IF EXISTS debemos CASCADE;
DROP TABLE IF EXISTS deudas CASCADE;
DROP TABLE IF EXISTS transacciones CASCADE;
DROP TABLE IF EXISTS precios_operativos CASCADE;
DROP TABLE IF EXISTS inventario CASCADE;
DROP TABLE IF EXISTS divisas CASCADE;

CREATE TABLE divisas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  nombre_completo TEXT,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE precios_operativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_moneda TEXT NOT NULL REFERENCES divisas(codigo),
  precio_compra DECIMAL(15, 2) DEFAULT 0,
  precio_venta DECIMAL(15, 2) DEFAULT 0,
  precio_mercado_ref DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_precios_operativos_user_fecha ON precios_operativos (usuario_id, codigo_moneda, created_at DESC);

CREATE TABLE transacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cajero_id UUID REFERENCES auth.users(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('COMPRA', 'VENTA')),
  moneda TEXT NOT NULL REFERENCES divisas(codigo),
  monto_divisa DECIMAL(15, 2) NOT NULL,
  tasa_aplicada DECIMAL(15, 2) NOT NULL,
  total_cop DECIMAL(15, 2) NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transacciones_fecha ON transacciones (fecha DESC);

CREATE TABLE deudas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('DEBEN', 'DEBO')),
  responsable TEXT NOT NULL,
  divisa TEXT NOT NULL REFERENCES divisas(codigo),
  monto DECIMAL(15, 2) NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deudas_user ON deudas (usuario_id, tipo);

CREATE TABLE inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  divisa TEXT NOT NULL REFERENCES divisas(codigo),
  denominacion NUMERIC(15, 2) NOT NULL,
  cantidad NUMERIC(15, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (divisa, denominacion)
);

ALTER TABLE divisas ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_operativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY divisas_all ON divisas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY precios_operativos_all ON precios_operativos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY transacciones_all ON transacciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY deudas_all ON deudas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY inventario_all ON inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO divisas (codigo, nombre, nombre_completo) VALUES
  ('USD', 'Dólar', 'Dólar Estadounidense'),
  ('EUR', 'Euro', 'Euro'),
  ('GBP', 'Libra', 'Libra Esterlina'),
  ('BRL', 'Real', 'Real Brasileño'),
  ('MXN', 'Peso MX', 'Peso Mexicano')
ON CONFLICT (codigo) DO NOTHING;
