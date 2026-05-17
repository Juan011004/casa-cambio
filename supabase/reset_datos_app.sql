-- RESET de datos (sin tocar catálogos como `divisas`).
-- Opción A (RECOMENDADA): borra SOLO los datos del usuario indicado.
-- Opción B: TRUNCATE GLOBAL (solo si eres el único usuario).

-- ============================================================
-- OPCIÓN A: RESET POR USUARIO (seguro multi-tenant)
-- ============================================================
DO $$
DECLARE
  v_user UUID := NULL; -- <-- Pega aquí tu usuario_id (auth.users.id) y quita NULL.
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Configura v_user con tu usuario_id antes de ejecutar.';
  END IF;

  -- Importante: orden “de hijos a padres” por posibles FK.
  DELETE FROM public.transacciones    WHERE usuario_id = v_user;
  DELETE FROM public.gastos           WHERE usuario_id = v_user;
  DELETE FROM public.deudas           WHERE usuario_id = v_user;

  DELETE FROM public.caja_diaria      WHERE usuario_id = v_user;
  DELETE FROM public.caja_precios     WHERE usuario_id = v_user;

  DELETE FROM public.cierres_diarios  WHERE usuario_id = v_user;
  DELETE FROM public.balances_diarios WHERE usuario_id = v_user;

  DELETE FROM public.inventario       WHERE usuario_id = v_user;

  DELETE FROM public.auditoria_overrides     WHERE usuario_id = v_user;
  DELETE FROM public.ganancia_dia_override     WHERE usuario_id = v_user;
  DELETE FROM public.ganancia_acumulada_inicial WHERE usuario_id = v_user;

  -- Normalmente TRM se conserva (histórico/operación). Si quieres resetearla para tu usuario,
  -- descomenta si tu tabla tiene usuario_id (si NO tiene, no lo borres).
  -- DELETE FROM public.trm_mercado WHERE usuario_id = v_user;

  RAISE NOTICE 'Reset por usuario completado: %', v_user;
END $$;

-- ============================================================
-- OPCIÓN B: TRUNCATE GLOBAL (PELIGROSO)
--   - Borra datos de TODOS los usuarios.
--   - NO tocar `divisas` ni tablas “catálogo”.
--   - Ejecuta solo si estás 100% seguro.
-- ============================================================
-- BEGIN;
-- TRUNCATE TABLE
--   public.transacciones,
--   public.gastos,
--   public.deudas,
--   public.caja_diaria,
--   public.caja_precios,
--   public.cierres_diarios,
--   public.balances_diarios,
--   public.inventario,
--   public.auditoria_overrides,
--   public.ganancia_dia_override,
--   public.ganancia_acumulada_inicial
-- RESTART IDENTITY CASCADE;
-- COMMIT;

