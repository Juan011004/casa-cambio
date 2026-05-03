-- Refinamiento estructural (ejecutar una vez en Supabase SQL Editor).
-- ADVERTENCIA: TRUNCATE divisas CASCADE vacía también tablas con FK hacia divisas
-- (transacciones, inventario, deudas, etc.). Si debe conservar datos, use solo los bloques 2 y 3
-- y actualice divisas con INSERT ... ON CONFLICT en lugar de TRUNCATE.

-- 1. CATÁLOGO DE DIVISAS
TRUNCATE TABLE divisas CASCADE;

INSERT INTO divisas (codigo, nombre, nombre_completo) VALUES
  ('COP', 'Peso Col', 'Peso Colombiano'),
  ('USD', 'Dólar', 'Dólar Estadounidense'),
  ('EUR', 'Euro', 'Euro'),
  ('MXN', 'Peso MX', 'Peso Mexicano'),
  ('CAD', 'Dólar CAN', 'Dólar Canadiense'),
  ('GBP', 'Libra', 'Libra Esterlina'),
  ('CLP', 'Peso CHI', 'Peso Chileno'),
  ('BRL', 'Real', 'Real Brasileño'),
  ('PEN', 'Sol', 'Sol Peruano'),
  ('ARS', 'Peso ARG', 'Peso Argentino'),
  ('AUD', 'Dólar AUS', 'Dólar Australiano'),
  ('OTRO', 'Otro', 'Otra Divisa');

-- 2. MÉTODO DE PAGO EN TRANSACCIONES
ALTER TABLE transacciones
  ADD COLUMN IF NOT EXISTS metodo_pago TEXT CHECK (metodo_pago IN ('Efectivo', 'Nequi', 'Cheque')) DEFAULT 'Efectivo';

UPDATE transacciones SET metodo_pago = 'Efectivo' WHERE metodo_pago IS NULL;

-- 3. ESTADO EN DEUDAS (saldar = actualizar, no borrar)
ALTER TABLE deudas
  ADD COLUMN IF NOT EXISTS estado TEXT CHECK (estado IN ('PENDIENTE', 'SALDADO')) DEFAULT 'PENDIENTE';

UPDATE deudas SET estado = 'PENDIENTE' WHERE estado IS NULL;
