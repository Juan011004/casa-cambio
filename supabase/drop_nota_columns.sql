-- Ejecutar si ya tiene columnas nota/notas de versiones anteriores
ALTER TABLE IF EXISTS public.transacciones DROP COLUMN IF EXISTS nota;
ALTER TABLE IF EXISTS public.deudas DROP COLUMN IF EXISTS nota;
