import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Profile, Week } from '../models';

@Injectable({ providedIn: 'root' })
export class WeekService {
  private readonly db = inject(SupabaseService).client;

  /** Devuelve la semana de la fecha dada; la crea con su responsable (rotación) si no existe. */
  async ensureWeek(date: Date = new Date()): Promise<Week> {
    const { data, error } = await this.db.rpc('ensure_week', { p_date: toIsoDate(date) });
    if (error) throw error;
    return data as Week;
  }

  async getProfiles(): Promise<Profile[]> {
    const { data, error } = await this.db.from('profiles').select('*').order('turn_order');
    if (error) throw error;
    return data as Profile[];
  }
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
