-- Índices para consultas por usuario y fechas (ejecutar en Supabase SQL Editor).
-- Pooling: en la cadena de conexión de cliente servidor usa el puerto 6543 (Transaction mode)
-- desde Dashboard → Connect → "Connection pooling" si necesitas muchas conexiones concurrentes.

CREATE INDEX IF NOT EXISTS idx_transacciones_usuario_fecha ON public.transacciones (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_usuario_fecha ON public.gastos (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_deudas_usuario_estado ON public.deudas (usuario_id, estado);
CREATE INDEX IF NOT EXISTS idx_caja_usuario_fecha ON public.caja_diaria (usuario_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_inventario_usuario_divisa ON public.inventario (usuario_id, divisa);
