-- =========================================================
-- Migración 004: notificaciones push
-- Ejecutar en: Supabase > SQL Editor (DESPUÉS de desplegar la función "push")
--
-- Antes, sustituye el valor marcado con <<...>> (solo al pegarlo en el editor, no en este archivo):
--   <<PUSH_SECRET>>  -> el mismo secreto que pusiste en la función (supabase secrets set PUSH_SECRET=...)
-- =========================================================

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 1. Suscripciones (una por usuario y dispositivo) -----------
create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- Cada uno solo ve y gestiona sus propios dispositivos
create policy "own push subs" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Configuración privada (URL y secreto de la función) -----
select vault.create_secret('https://lajksdpoifobxzsocuff.supabase.co/functions/v1/push', 'push_url');
select vault.create_secret('<<PUSH_SECRET>>', 'push_secret');

-- Llama a la función push sin bloquear la transacción (pg_net es asíncrono)
create or replace function public.call_push(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  perform net.http_post(
    url     := v_url,
    body    := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret)
  );
end;
$$;
revoke all on function public.call_push(jsonb) from public, anon, authenticated;

-- 3. Disparadores: jugada nueva y premio nuevo ----------------
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.call_push(jsonb_build_object('type', tg_argv[0], 'record', to_jsonb(new)));
  return new;
end;
$$;

drop trigger if exists trg_push_play on public.plays;
create trigger trg_push_play after insert on public.plays
  for each row execute function public.notify_push('play');

drop trigger if exists trg_push_prize on public.prizes;
create trigger trg_push_prize after insert on public.prizes
  for each row execute function public.notify_push('prize');

-- 4. Recordatorio los días de sorteo (martes y viernes) -------
-- 09:00 UTC = 10:00 en invierno / 11:00 en verano (hora peninsular)
select cron.unschedule('push-reminder') where exists (select 1 from cron.job where jobname = 'push-reminder');
select cron.schedule('push-reminder', '0 9 * * 2,5',
  $$ select public.call_push('{"type":"reminder"}'::jsonb) $$);
