-- Reestructuración v4: caja diaria y ganancia en transacciones (ejecutar en Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS caja_diaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id),
    fecha DATE DEFAULT CURRENT_DATE,
    tipo TEXT CHECK (tipo IN ('APERTURA', 'CIERRE')),
    moneda TEXT REFERENCES divisas(codigo),
    monto DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, fecha, tipo, moneda)
);

ALTER TABLE transacciones ADD COLUMN IF NOT EXISTS ganancia_cop DECIMAL(15, 2) DEFAULT 0;

UPDATE transacciones SET ganancia_cop = 0 WHERE ganancia_cop IS NULL;

ALTER TABLE caja_diaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caja_diaria_all ON caja_diaria;
CREATE POLICY caja_diaria_all ON caja_diaria FOR ALL TO authenticated USING (true) WITH CHECK (true);
