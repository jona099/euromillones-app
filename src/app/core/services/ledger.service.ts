import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Play, Prize, Profile, Transfer, Week } from '../models';

/** Toda la información de la peña en una sola carga (para Historial y Peña). */
export interface PenaData {
  profiles: Profile[];
  weeks: Week[];
  plays: Play[];
  prizes: Prize[];
  transfers: Transfer[];
}

export interface PersonBalance {
  profile: Profile;
  paid: number;       // boletos adelantados en sus turnos
  held: number;       // premios cobrados por él
  sent: number;       // pagos hechos a otros
  received: number;   // pagos recibidos de otros
  net: number;        // > 0 le deben; < 0 debe
}

export interface Settlement { from: Profile; to: Profile; amount: number; }

export interface RankingRow {
  profile: Profile;
  turns: number;
  winningTurns: number;
  prizes: number;
  won: number;
  best: number;
  hitRate: number;
}

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly db = inject(SupabaseService).client;

  async load(): Promise<PenaData> {
    const [profiles, weeks, plays, prizes, transfers] = await Promise.all([
      this.db.from('profiles').select('*').order('turn_order'),
      this.db.from('weeks').select('*').order('week_start'),
      this.db.from('plays').select('*').order('draw_date'),
      this.db.from('prizes').select('*'),
      this.db.from('transfers').select('*').order('paid_on', { ascending: false }),
    ]);
    for (const r of [profiles, weeks, plays, prizes, transfers]) if (r.error) throw r.error;
    return {
      profiles: profiles.data as Profile[],
      weeks: weeks.data as Week[],
      plays: (plays.data as Play[]).map(p => ({ ...p, price: Number(p.price) })),
      prizes: (prizes.data as Prize[]).map(p => ({ ...p, amount: Number(p.amount) })),
      transfers: (transfers.data as Transfer[]).map(t => ({ ...t, amount: Number(t.amount) })),
    };
  }

  async addTransfer(t: Pick<Transfer, 'from_id' | 'to_id' | 'amount' | 'note'>): Promise<void> {
    const { error } = await this.db.from('transfers').insert(t);
    if (error) throw error;
  }

  async deleteTransfer(id: number): Promise<void> {
    const { error } = await this.db.from('transfers').delete().eq('id', id);
    if (error) throw error;
  }
}

// ------------------------------------------------------------------
// Cálculos puros (sin estado): fáciles de testear y reutilizar
// ------------------------------------------------------------------

/**
 * Balance por persona.
 * Cada uno debería pagar 1/N de lo invertido y recibir 1/N de lo ganado.
 * net = pagado - cuota + parte_premios - premios_retenidos + enviado - recibido
 * La suma de todos los net es siempre 0.
 */
export function computeBalances(d: PenaData): PersonBalance[] {
  const n = d.profiles.length || 1;
  const weekOwner = new Map(d.weeks.map(w => [w.id, w.responsible_id]));
  const playOwner = new Map(d.plays.map(p => [p.id, weekOwner.get(p.week_id)]));
  const invested = d.plays.reduce((s, p) => s + p.price, 0);
  const won = d.prizes.reduce((s, p) => s + p.amount, 0);

  return d.profiles.map(profile => {
    const paid = d.plays.filter(p => weekOwner.get(p.week_id) === profile.id).reduce((s, p) => s + p.price, 0);
    const held = d.prizes
      .filter(p => (p.collected_by ?? playOwner.get(p.play_id)) === profile.id)
      .reduce((s, p) => s + p.amount, 0);
    const sent = d.transfers.filter(t => t.from_id === profile.id).reduce((s, t) => s + t.amount, 0);
    const received = d.transfers.filter(t => t.to_id === profile.id).reduce((s, t) => s + t.amount, 0);
    const net = round2(paid - invested / n + won / n - held + sent - received);
    return { profile, paid, held, sent, received, net };
  });
}

/** Mínimas transferencias para quedar a cero (greedy deudor mayor → acreedor mayor). */
export function settle(balances: PersonBalance[]): Settlement[] {
  const creditors = balances.filter(b => b.net > 0.009).map(b => ({ p: b.profile, v: b.net }));
  const debtors = balances.filter(b => b.net < -0.009).map(b => ({ p: b.profile, v: -b.net }));
  const out: Settlement[] = [];

  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.v - a.v);
    debtors.sort((a, b) => b.v - a.v);
    const c = creditors[0], d = debtors[0];
    const amount = round2(Math.min(c.v, d.v));
    out.push({ from: d.p, to: c.p, amount });
    c.v = round2(c.v - amount);
    d.v = round2(d.v - amount);
    if (c.v <= 0.009) creditors.shift();
    if (d.v <= 0.009) debtors.shift();
  }
  return out;
}

/** Ranking de suerte por turno: premios conseguidos en las semanas de cada uno. */
export function computeRanking(d: PenaData): RankingRow[] {
  const playWeek = new Map(d.plays.map(p => [p.id, p.week_id]));
  const weeksWithPlays = new Set(d.plays.map(p => p.week_id));

  return d.profiles
    .map(profile => {
      const myWeeks = d.weeks.filter(w => w.responsible_id === profile.id && weeksWithPlays.has(w.id));
      const myWeekIds = new Set(myWeeks.map(w => w.id));
      const myPrizes = d.prizes.filter(pr => myWeekIds.has(playWeek.get(pr.play_id)!));
      const winningWeeks = new Set(myPrizes.map(pr => playWeek.get(pr.play_id)));
      return {
        profile,
        turns: myWeeks.length,
        winningTurns: winningWeeks.size,
        prizes: myPrizes.length,
        won: myPrizes.reduce((s, p) => s + p.amount, 0),
        best: myPrizes.reduce((m, p) => Math.max(m, p.amount), 0),
        hitRate: myWeeks.length ? winningWeeks.size / myWeeks.length : 0,
      };
    })
    .sort((a, b) => b.won - a.won || b.hitRate - a.hitRate);
}

/** Frecuencia de cada número y estrella en todas las jugadas. */
export function computeFrequency(plays: Play[]): { numbers: number[]; stars: number[] } {
  const numbers = Array<number>(51).fill(0);
  const stars = Array<number>(13).fill(0);
  for (const p of plays) {
    p.numbers.forEach(n => numbers[n]++);
    p.stars.forEach(s => stars[s]++);
  }
  return { numbers, stars };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
