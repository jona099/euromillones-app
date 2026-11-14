import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Play, Prize } from '../models';

export interface PrizeWithPlay extends Prize {
  play: Pick<Play, 'id' | 'draw_date' | 'numbers' | 'stars'>;
}

export interface NewPrize {
  play_id: number;
  category: string | null;
  amount: number;
}

/** Categorías oficiales de Euromillones (aciertos números + estrellas). */
export const PRIZE_CATEGORIES = [
  '5+2', '5+1', '5+0', '4+2', '4+1', '3+2', '4+0',
  '2+2', '3+1', '3+0', '1+2', '2+1', '2+0',
] as const;

@Injectable({ providedIn: 'root' })
export class PrizesService {
  private readonly db = inject(SupabaseService).client;

  async getAll(): Promise<PrizeWithPlay[]> {
    const { data, error } = await this.db
      .from('prizes')
      .select('*, play:plays(id, draw_date, numbers, stars)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as PrizeWithPlay[];
  }

  async getByPlays(playIds: number[]): Promise<Prize[]> {
    if (!playIds.length) return [];
    const { data, error } = await this.db.from('prizes').select('*').in('play_id', playIds);
    if (error) throw error;
    return data as Prize[];
  }

  async create(prize: NewPrize): Promise<void> {
    const { error } = await this.db.from('prizes').insert(prize);
    if (error) throw error;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.db.from('prizes').delete().eq('id', id);
    if (error) throw error;
  }
}
