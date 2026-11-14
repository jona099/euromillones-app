-- =========================================================
-- Euromillones entre amigos - Esquema Supabase (Postgres)
-- Ejecutar en: Supabase > SQL Editor
-- =========================================================

-- 1. PERFILES ------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  turn_order   smallint not null unique check (turn_order between 0 and 2)
);

-- 2. CONFIGURACIÓN (fecha ancla de la rotación) -------------
create table if not exists public.settings (
  id               smallint primary key default 1 check (id = 1),
  rotation_start   date not null,           -- lunes en que empieza turn_order = 0
  ticket_price     numeric(6,2) not null default 2.50
);

-- 3. SEMANAS -------------------------------------------------
create table if not exists public.weeks (
  id             bigint generated always as identity primary key,
  week_start     date not null unique check (extract(isodow from week_start) = 1),
  responsible_id uuid not null references public.profiles(id)
);

-- 4. JUGADAS -------------------------------------------------
create table if not exists public.plays (
  id          bigint generated always as identity primary key,
  week_id     bigint not null references public.weeks(id) on delete cascade,
  draw_date   date not null check (extract(isodow from draw_date) in (2, 5)), -- martes o viernes
  numbers     smallint[] not null,
  stars       smallint[] not null,
  price       numeric(6,2) not null default 2.50,
  created_by  uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now(),
  constraint chk_numbers check (
    array_length(numbers, 1) = 5
    and 1 <= all(numbers) and 50 >= all(numbers)
  ),
  constraint chk_stars check (
    array_length(stars, 1) = 2
    and 1 <= all(stars) and 12 >= all(stars)
  )
);
create index if not exists ix_plays_week on public.plays(week_id);

-- 5. PREMIOS -------------------------------------------------
create table if not exists public.prizes (
  id          bigint generated always as identity primary key,
  play_id     bigint not null references public.plays(id) on delete cascade,
  category    text,
  amount      numeric(12,2) not null check (amount >= 0),
  created_by  uuid not null default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists ix_prizes_play on public.prizes(play_id);

-- 6. FUNCIÓN: obtener/crear la semana con su responsable ----
-- Rotación: (semanas desde rotation_start) mod 3 -> turn_order
create or replace function public.ensure_week(p_date date)
returns public.weeks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monday date := date_trunc('week', p_date)::date;
  v_start  date;
  v_turn   int;
  v_week   public.weeks;
begin
  select * into v_week from weeks where week_start = v_monday;
  if found then return v_week; end if;

  select rotation_start into v_start from settings where id = 1;
  v_turn := (((v_monday - v_start) / 7) % 3 + 3) % 3;  -- módulo positivo

  insert into weeks (week_start, responsible_id)
  select v_monday, p.id from profiles p where p.turn_order = v_turn
  returning * into v_week;

  return v_week;
end;
$$;

-- 7. VISTA DASHBOARD (agregaciones separadas: sin duplicados) -
create or replace view public.v_weekly_balance
with (security_invoker = true) as
with inv as (
  select week_id, sum(price) as invested, count(*) as plays_count
  from plays group by week_id
),
won as (
  select pl.week_id, sum(pr.amount) as won
  from prizes pr join plays pl on pl.id = pr.play_id
  group by pl.week_id
)
select w.id as week_id,
       w.week_start,
       p.display_name             as responsible,
       coalesce(inv.plays_count,0) as plays_count,
       coalesce(inv.invested,0)    as invested,
       coalesce(won.won,0)         as won,
       coalesce(won.won,0) - coalesce(inv.invested,0) as balance
from weeks w
join profiles p on p.id = w.responsible_id
left join inv on inv.week_id = w.id
left join won on won.week_id = w.id;

-- 8. ROW LEVEL SECURITY -------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.weeks    enable row level security;
alter table public.plays    enable row level security;
alter table public.prizes   enable row level security;

create policy "auth read profiles" on public.profiles for select to authenticated using (true);
create policy "auth read settings" on public.settings for select to authenticated using (true);
create policy "auth read weeks"    on public.weeks    for select to authenticated using (true);

create policy "auth all plays"  on public.plays  for all to authenticated using (true) with check (true);
create policy "auth all prizes" on public.prizes for all to authenticated using (true) with check (true);

grant execute on function public.ensure_week(date) to authenticated;

-- =========================================================
-- 9. DATOS INICIALES (ejecutar DESPUÉS de crear los 3 usuarios
--    en Authentication > Users y sustituir los UUID)
-- =========================================================
-- insert into public.settings (rotation_start) values ('2026-11-16'); -- un lunes
-- insert into public.profiles (id, display_name, turn_order) values
--   ('UUID-DE-JONA',   'Jona',   0),
--   ('UUID-DE-SERGIO', 'Sergio', 1),
--   ('UUID-DE-FER',    'Fer',    2);
