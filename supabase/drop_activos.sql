-- El patrimonio en COP pasa a calcularse solo con arqueo_tengo.
-- Ejecutar en Supabase SQL Editor cuando el frontend ya no use `activos`.

DROP TABLE IF EXISTS public.activos CASCADE;
