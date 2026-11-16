import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Profile, Week } from '../models';
import { toIsoDate } from './week.service';

export interface TurnsData {
  profiles: Profile[];
  rotationStart: string;          // lunes ancla (turn_order = 0)
  overrides: Map<string, string>; // week_start -> responsible_id (semanas ya creadas)
}

@Injectable({ providedIn: 'root' })
export class TurnsService {
  private readonly db = inject(SupabaseService).client;

  async load(): Promise<TurnsData> {
    const [profiles, settings, weeks] = await Promise.all([
      this.db.from('profiles').select('*').order('turn_order'),
      this.db.from('settings').select('rotation_start').eq('id', 1).single(),
      this.db.from('weeks').select('week_start, responsible_id'),
    ]);
    for (const r of [profiles, settings, weeks]) if (r.error) throw r.error;
    return {
      profiles: profiles.data as Profile[],
      rotationStart: (settings.data as { rotation_start: string }).rotation_start,
      overrides: new Map((weeks.data as Pick<Week, 'week_start' | 'responsible_id'>[])
        .map(w => [w.week_start, w.responsible_id])),
    };
  }

  /** Intercambia el responsable de las semanas de ambas fechas (RPC swap_turns). */
  async swap(a: Date, b: Date): Promise<void> {
    const { error } = await this.db.rpc('swap_turns', { p_a: toIsoDate(a), p_b: toIsoDate(b) });
    if (error) throw error;
  }
}

// ------------------------------------------------------------------
// Cálculos puros
// ------------------------------------------------------------------

/** Lunes (00:00 local) de la semana de la fecha. */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Responsable de la semana: la fila guardada manda; si no, la rotación (igual que ensure_week). */
export function responsibleFor(monday: Date, data: TurnsData): Profile | undefined {
  const saved = data.overrides.get(toIsoDate(monday));
  if (saved) return data.profiles.find(p => p.id === saved);
  const weeks = Math.round((monday.getTime() - parseIso(data.rotationStart).getTime()) / (7 * 86_400_000));
  const n = data.profiles.length || 3;
  const turn = ((weeks % n) + n) % n;
  return data.profiles.find(p => p.turn_order === turn);
}

export interface CalendarDay {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isDraw: boolean;   // martes o viernes
  monday: string;    // ISO del lunes de su semana
  who?: Profile;
}

/** Rejilla de 6 semanas (lunes a domingo) del mes dado. */
export function monthGrid(year: number, month: number, data: TurnsData, today = new Date()): CalendarDay[][] {
  const start = mondayOf(new Date(year, month, 1));
  const todayIso = toIsoDate(today);
  const rows: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const monday = new Date(start);
    monday.setDate(start.getDate() + w * 7);
    if (w > 0 && monday.getMonth() !== month) break;
    const who = responsibleFor(monday, data);
    const row: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      row.push({
        date,
        inMonth: date.getMonth() === month,
        isToday: toIsoDate(date) === todayIso,
        isDraw: i === 1 || i === 4,
        monday: toIsoDate(monday),
        who,
      });
    }
    rows.push(row);
  }
  return rows;
}
