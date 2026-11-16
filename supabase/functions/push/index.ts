// Edge Function "push": envía notificaciones Web Push a la peña.
// La llaman los triggers de la base de datos (jugada / premio) y pg_cron (recordatorio).
// Despliegue: supabase functions deploy push --no-verify-jwt
// Secretos:   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... PUSH_SECRET=...
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface Sub { id: number; user_id: string; endpoint: string; p256dh: string; auth: string }
interface Msg { title: string; body: string; url: string; tag: string }

Deno.serve(async req => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const { type, record } = await req.json();
    const job = type === 'play' ? onPlay(record)
      : type === 'prize' ? onPrize(record)
      : type === 'reminder' ? onReminder()
      : null;
    const result = job ? await job : null;
    if (!result) return json({ sent: 0 });
    const sent = await send(result.to, result.msg);
    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

// ---------------- Casos ----------------

/** Jugada nueva: los números a todos menos a quien la apunta. */
async function onPlay(p: { created_by: string; draw_date: string; numbers: number[]; stars: number[] }) {
  const author = await nameOf(p.created_by);
  const nums = [...p.numbers].sort((a, b) => a - b).join(' · ');
  const stars = [...p.stars].sort((a, b) => a - b).join(' · ');
  return {
    to: await usersExcept(p.created_by),
    msg: {
      title: `🎟️ ${author} ha jugado para el ${fmtDate(p.draw_date)}`,
      body: `${nums}   ★ ${stars}`,
      url: '/#/jugadas',
      tag: `play-${p.draw_date}-${nums}-${stars}`,
    },
  };
}

/** Premio nuevo: a todos menos a quien lo apunta. */
async function onPrize(pr: { play_id: number; amount: number; category: string | null; created_by: string }) {
  const { data: play } = await db.from('plays').select('draw_date').eq('id', pr.play_id).single();
  const author = await nameOf(pr.created_by);
  const amount = Number(pr.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  const cat = pr.category ? ` (${pr.category})` : '';
  return {
    to: await usersExcept(pr.created_by),
    msg: {
      title: `🏆 ¡Premio de ${amount}!`,
      body: `${author} ha apuntado un premio${cat}${play ? ` del sorteo del ${fmtDate(play.draw_date)}` : ''}.`,
      url: '/#/premios',
      tag: `prize-${pr.play_id}`,
    },
  };
}

/** Día de sorteo: aviso al responsable de la semana si aún no ha apuntado jugada para hoy. */
async function onReminder() {
  const today = madridToday();
  const { data: week, error } = await db.rpc('ensure_week', { p_date: today });
  if (error) throw error;
  const { count } = await db.from('plays').select('id', { count: 'exact', head: true })
    .eq('week_id', week.id).eq('draw_date', today);
  if (count) return null;
  return {
    to: [week.responsible_id as string],
    msg: {
      title: '🍀 Hoy hay sorteo y te toca',
      body: `Echa la jugada del Euromillones antes de las 19:30 y apúntala en Trébol.`,
      url: '/#/jugadas',
      tag: `reminder-${today}`,
    },
  };
}

// ---------------- Utilidades ----------------

async function send(userIds: string[], msg: Msg): Promise<number> {
  if (!userIds.length) return 0;
  const { data } = await db.from('push_subscriptions').select('*').in('user_id', userIds);
  const subs = (data ?? []) as Sub[];

  // Formato que entiende el service worker de Angular (ngsw)
  const payload = JSON.stringify({
    notification: {
      title: msg.title,
      body: msg.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: msg.tag,
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: msg.url } } },
    },
  });

  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Suscripción caducada o revocada: se limpia
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('push error', status, e);
    }
  }));
  return sent;
}

async function usersExcept(id: string): Promise<string[]> {
  const { data } = await db.from('profiles').select('id').neq('id', id);
  return (data ?? []).map(p => p.id as string);
}

async function nameOf(id: string): Promise<string> {
  const { data } = await db.from('profiles').select('display_name').eq('id', id).single();
  return data?.display_name ?? 'Alguien';
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12))
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', timeZone: 'UTC' });
}

function madridToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
