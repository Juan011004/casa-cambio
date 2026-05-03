create table if not exists public.nos_deben (
  id uuid primary key default gen_random_uuid(),
  responsable text not null,
  divisa text not null,
  monto numeric not null,
  nota text,
  created_at timestamptz not null default now()
);

create table if not exists public.debemos (
  id uuid primary key default gen_random_uuid(),
  responsable text not null,
  divisa text not null,
  monto numeric not null,
  nota text,
  created_at timestamptz not null default now()
);

alter table public.nos_deben enable row level security;
alter table public.debemos enable row level security;
