import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Play } from '../models';

export interface NewPlay {
  week_id: number;
  draw_date: string;
  numbers: number[];
  stars: number[];
}

@Injectable({ providedIn: 'root' })
export class PlaysService {
  private readonly db = inject(SupabaseService).client;

  async getByWeek(weekId: number): Promise<Play[]> {
    const { data, error } = await this.db
      .from('plays')
      .select('*')
      .eq('week_id', weekId)
      .order('draw_date')
      .order('created_at');
    if (error) throw error;
    return data as Play[];
  }

  /** Jugadas de los últimos N días (para asignar premios). */
  async getRecent(days = 90): Promise<Play[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);
    const { data, error } = await this.db
      .from('plays')
      .select('*')
      .gte('draw_date', from.toISOString().slice(0, 10))
      .order('draw_date', { ascending: false });
    if (error) throw error;
    return data as Play[];
  }

  async create(play: NewPlay): Promise<Play> {
    const payload = {
      ...play,
      numbers: [...play.numbers].sort((a, b) => a - b),
      stars: [...play.stars].sort((a, b) => a - b),
    };
    const { data, error } = await this.db.from('plays').insert(payload).select().single();
    if (error) throw error;
    return data as Play;
  }

  async update(id: number, play: Omit<NewPlay, 'week_id'>): Promise<Play> {
    const payload = {
      ...play,
      numbers: [...play.numbers].sort((a, b) => a - b),
      stars: [...play.stars].sort((a, b) => a - b),
    };
    const { data, error } = await this.db.from('plays').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data as Play;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.db.from('plays').delete().eq('id', id);
    if (error) throw error;
  }
}
