-- =========================================================
-- Migración 003: intercambio de turnos entre dos semanas
-- Ejecutar en: Supabase > SQL Editor
-- =========================================================
-- Crea (si hace falta) las dos semanas con su responsable por rotación
-- y les intercambia el responsable. Solo semanas presentes o futuras.
create or replace function public.swap_turns(p_a date, p_b date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := date_trunc('week', current_date)::date;
  v_a public.weeks;
  v_b public.weeks;
begin
  if date_trunc('week', p_a)::date < v_today or date_trunc('week', p_b)::date < v_today then
    raise exception 'Solo se pueden cambiar semanas actuales o futuras';
  end if;

  v_a := public.ensure_week(p_a);
  v_b := public.ensure_week(p_b);
  if v_a.id = v_b.id then return; end if;

  update weeks set responsible_id = v_b.responsible_id where id = v_a.id;
  update weeks set responsible_id = v_a.responsible_id where id = v_b.id;
end;
$$;

grant execute on function public.swap_turns(date, date) to authenticated;
