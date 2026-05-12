-- Añade override manual de ganancia COP por moneda/día (ejecutar si ya existe la tabla).
ALTER TABLE public.auditoria_overrides
  ADD COLUMN IF NOT EXISTS ganancia_cop numeric(20, 2);
