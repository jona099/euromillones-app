import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { WeeklyBalance } from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly db = inject(SupabaseService).client;

  async getWeekly(): Promise<WeeklyBalance[]> {
    const { data, error } = await this.db
      .from('v_weekly_balance')
      .select('*')
      .order('week_start');
    if (error) throw error;
    // numeric de Postgres llega como string/number según driver: normalizamos
    return (data ?? []).map(r => ({
      ...r,
      invested: Number(r.invested),
      won: Number(r.won),
      balance: Number(r.balance),
      plays_count: Number(r.plays_count),
    })) as WeeklyBalance[];
  }
}
