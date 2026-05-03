-- Ejecutar en Supabase SQL Editor (reestructuración + gastos)

DROP TABLE IF EXISTS precios_operativos CASCADE;
DROP TABLE IF EXISTS gastos CASCADE;

CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id),
    concepto TEXT NOT NULL,
    monto_cop DECIMAL(15, 2) NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO divisas (codigo, nombre, nombre_completo)
VALUES ('COP', 'Peso Col', 'Peso Colombiano')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY gastos_all ON gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_gastos_fecha ON gastos (fecha DESC);
