-- =========================================================
-- Trébol · Migración 002
-- Favoritas, quién cobra cada premio, pagos entre amigos
-- y fotos de boletos.
-- Ejecutar en: Supabase > SQL Editor (una sola vez)
-- =========================================================

-- 1. COMBINACIONES FAVORITAS --------------------------------
create table if not exists public.favorites (
  id          bigint generated always as identity primary key,
  name        text not null,
  numbers     smallint[] not null,
  stars       smallint[] not null,
  created_by  uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint chk_fav_numbers check (array_length(numbers, 1) = 5 and 1 <= all(numbers) and 50 >= all(numbers)),
  constraint chk_fav_stars   check (array_length(stars, 1) = 2 and 1 <= all(stars) and 12 >= all(stars))
);

-- 2. QUIÉN HA COBRADO CADA PREMIO ---------------------------
-- null = lo cobra el responsable de la semana (valor por defecto)
alter table public.prizes
  add column if not exists collected_by uuid references public.profiles(id);

-- 3. PAGOS ENTRE AMIGOS (para saldar cuentas) ---------------
create table if not exists public.transfers (
  id          bigint generated always as identity primary key,
  from_id     uuid not null references public.profiles(id),
  to_id       uuid not null references public.profiles(id),
  amount      numeric(10,2) not null check (amount > 0),
  note        text,
  paid_on     date not null default current_date,
  created_by  uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint chk_transfer_distinct check (from_id <> to_id)
);

-- 4. FOTOS DE BOLETOS ---------------------------------------
create table if not exists public.ticket_photos (
  id          bigint generated always as identity primary key,
  week_id     bigint not null references public.weeks(id) on delete cascade,
  path        text not null unique,          -- ruta en el bucket 'tickets'
  created_by  uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists ix_ticket_photos_week on public.ticket_photos(week_id);

-- Bucket privado para las fotos
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do nothing;

-- 5. RLS ----------------------------------------------------
alter table public.favorites     enable row level security;
alter table public.transfers     enable row level security;
alter table public.ticket_photos enable row level security;

create policy "auth all favorites"     on public.favorites     for all to authenticated using (true) with check (true);
create policy "auth all transfers"     on public.transfers     for all to authenticated using (true) with check (true);
create policy "auth all ticket_photos" on public.ticket_photos for all to authenticated using (true) with check (true);

-- Storage: solo usuarios autenticados, solo en el bucket 'tickets'
create policy "auth read tickets"   on storage.objects for select to authenticated using (bucket_id = 'tickets');
create policy "auth upload tickets" on storage.objects for insert to authenticated with check (bucket_id = 'tickets');
create policy "auth delete tickets" on storage.objects for delete to authenticated using (bucket_id = 'tickets');
