-- Tabla de divisas con precios aplicados por la casa (compra / venta en COP por 1 unidad de divisa).
-- Ejecutar en Supabase SQL Editor si aún no existe.

create table if not exists public.divisas (
  moneda_codigo text primary key,
  nombre_completo text not null,
  valor_oficial numeric not null default 0,
  precio_compra_casa numeric not null default 0,
  precio_venta_casa numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.divisas enable row level security;

drop policy if exists "divisas_select_authenticated" on public.divisas;
drop policy if exists "divisas_update_authenticated" on public.divisas;

create policy "divisas_select_authenticated"
  on public.divisas for select to authenticated using (true);

create policy "divisas_update_authenticated"
  on public.divisas for update to authenticated using (true) with check (true);

insert into public.divisas (moneda_codigo, nombre_completo, valor_oficial, precio_compra_casa, precio_venta_casa)
values
  ('USD', 'Dólar Estadounidense', 0, 0, 0),
  ('EUR', 'Euro', 0, 0, 0),
  ('GBP', 'Libra Esterlina', 0, 0, 0),
  ('BRL', 'Real Brasileño', 0, 0, 0),
  ('MXN', 'Peso Mexicano', 0, 0, 0),
  ('ARS', 'Peso Argentino', 0, 0, 0),
  ('CLP', 'Peso Chileno', 0, 0, 0),
  ('PEN', 'Sol Peruano', 0, 0, 0)
on conflict (moneda_codigo) do nothing;

-- Histórico de referencia (reemplaza el nombre `trm` por `registro_trm` en la app).
-- Si antes usabas `public.trm`, puedes renombrar:
--   alter table public.trm rename to registro_trm;
-- O crear desde cero:
-- create table if not exists public.registro_trm (
--   id bigint generated always as identity primary key,
--   valor numeric not null,
--   created_at timestamptz not null default now()
-- );
