import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { LedgerService, PenaData } from '../../core/services/ledger.service';
import { ComboComponent } from '../../shared/combo/combo.component';
import { AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { Play, Profile } from '../../core/models';

interface Row {
  play: Play;
  owner?: Profile;
  won: number;
  month: string;   // yyyy-MM
}

import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { SkeletonComboComponent } from '../../shared/skeleton/skeleton-combo.component';
import { delayedLoading } from '../../shared/skeleton/delayed-loading';

@Component({
  selector: 'app-history',
  imports: [SkeletonComponent, SkeletonComboComponent, CurrencyPipe, DatePipe, ComboComponent, AvatarComponent, IconComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly ledger = inject(LedgerService);

  protected readonly data = signal<PenaData | null>(null);
  protected readonly loading = signal(true);
  /** Skeleton sin parpadeo: aparece tras 150 ms y dura al menos 300 ms. */
  protected readonly skeleton = delayedLoading(this.loading);

  // Filtros
  protected readonly person = signal<string>('all');
  protected readonly month = signal<string>('all');
  protected readonly onlyWon = signal(false);
  protected readonly number = signal<number | null>(null);

  private readonly rows = computed<Row[]>(() => {
    const d = this.data();
    if (!d) return [];
    const weekOwner = new Map(d.weeks.map(w => [w.id, w.responsible_id]));
    const prizeByPlay = new Map<number, number>();
    d.prizes.forEach(p => prizeByPlay.set(p.play_id, (prizeByPlay.get(p.play_id) ?? 0) + p.amount));
    return [...d.plays]
      .sort((a, b) => b.draw_date.localeCompare(a.draw_date) || b.id - a.id)
      .map(play => ({
        play,
        owner: d.profiles.find(p => p.id === weekOwner.get(play.week_id)),
        won: prizeByPlay.get(play.id) ?? 0,
        month: play.draw_date.slice(0, 7),
      }));
  });

  protected readonly months = computed(() => [...new Set(this.rows().map(r => r.month))]);
  protected readonly profiles = computed(() => this.data()?.profiles ?? []);

  protected readonly filtered = computed(() => {
    const person = this.person(), month = this.month(), onlyWon = this.onlyWon(), n = this.number();
    return this.rows().filter(r =>
      (person === 'all' || r.owner?.id === person) &&
      (month === 'all' || r.month === month) &&
      (!onlyWon || r.won > 0) &&
      (n === null || r.play.numbers.includes(n)));
  });

  /** Agrupado por sorteo para leerlo como un extracto. */
  protected readonly groups = computed(() => {
    const map = new Map<string, Row[]>();
    for (const r of this.filtered()) {
      const list = map.get(r.play.draw_date) ?? [];
      list.push(r);
      map.set(r.play.draw_date, list);
    }
    return [...map.entries()].map(([date, rows]) => ({ date, rows, owner: rows[0].owner }));
  });

  protected readonly totals = computed(() => {
    const f = this.filtered();
    const invested = f.reduce((s, r) => s + r.play.price, 0);
    const won = f.reduce((s, r) => s + r.won, 0);
    return { count: f.length, invested, won, balance: won - invested };
  });

  protected readonly hasFilters = computed(() =>
    this.person() !== 'all' || this.month() !== 'all' || this.onlyWon() || this.number() !== null);

  async ngOnInit(): Promise<void> {
    try {
      this.data.set(await this.ledger.load());
    } finally {
      this.loading.set(false);
    }
  }

  protected setNumber(v: string): void {
    const n = Number(v);
    this.number.set(v && n >= 1 && n <= 50 ? n : null);
  }

  protected clear(): void {
    this.person.set('all');
    this.month.set('all');
    this.onlyWon.set(false);
    this.number.set(null);
  }

  protected monthLabel(m: string): Date {
    return new Date(`${m}-01T00:00:00`);
  }
}
