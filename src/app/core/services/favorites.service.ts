import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Favorite } from '../models';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly db = inject(SupabaseService).client;

  async getAll(): Promise<Favorite[]> {
    const { data, error } = await this.db.from('favorites').select('*').order('created_at');
    if (error) throw error;
    return data as Favorite[];
  }

  async create(fav: Pick<Favorite, 'name' | 'numbers' | 'stars'>): Promise<Favorite> {
    const payload = {
      ...fav,
      numbers: [...fav.numbers].sort((a, b) => a - b),
      stars: [...fav.stars].sort((a, b) => a - b),
    };
    const { data, error } = await this.db.from('favorites').insert(payload).select().single();
    if (error) throw error;
    return data as Favorite;
  }

  async delete(id: number): Promise<void> {
    const { error } = await this.db.from('favorites').delete().eq('id', id);
    if (error) throw error;
  }
}
