import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { WeekService } from '../../core/services/week.service';
import { AuthService } from '../../core/services/auth.service';
import { countdown, nextDraw } from '../../core/services/draw.util';
import { Profile, Week, WeeklyBalance } from '../../core/models';
import { AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';

interface ChartPoint { x: number; inv: number; won: number; }

const W = 900, H = 280, PAD = { t: 16, r: 16, b: 30, l: 56 };

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, RouterLink, AvatarComponent, IconComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly svc = inject(DashboardService);
  private readonly weekSvc = inject(WeekService);
  private readonly auth = inject(AuthService);

  protected readonly rows = signal<WeeklyBalance[]>([]);
  protected readonly profiles = signal<Profile[]>([]);
  protected readonly week = signal<Week | null>(null);
  protected readonly loading = signal(true);
  private readonly now = signal(new Date());
  private timer?: ReturnType<typeof setInterval>;

  // ---- Turno y próximo sorteo ------------------------------------------
  protected readonly responsible = computed(() =>
    this.profiles().find(p => p.id === this.week()?.responsible_id) ?? null);
  protected readonly isMyTurn = computed(() =>
    !!this.responsible() && this.responsible()!.id === this.auth.profile()?.id);
  protected readonly draw = computed(() => nextDraw(this.now()));
  protected readonly left = computed(() => countdown(this.draw(), this.now()));

  // ---- KPIs --------------------------------------------------------------
  /** Solo semanas con actividad (ensure_week crea semanas vacías al navegar). */
  protected readonly active = computed(() =>
    this.rows().filter(r => r.plays_count > 0 || r.won > 0));

  protected readonly invested = computed(() => sum(this.active(), r => r.invested));
  protected readonly won = computed(() => sum(this.active(), r => r.won));
  protected readonly playsCount = computed(() => sum(this.active(), r => r.plays_count));
  protected readonly balance = computed(() => this.won() - this.invested());
  protected readonly recovered = computed(() => (this.invested() ? this.won() / this.invested() : 0));
  protected readonly perHead = computed(() => this.balance() / Math.max(this.profiles().length, 1));
  protected readonly bestWeek = computed(() =>
    this.active().reduce<WeeklyBalance | null>((b, r) => (r.won > (b?.won ?? 0) ? r : b), null));

  protected readonly byPerson = computed(() => {
    const maxInv = Math.max(1, ...this.profiles().map(p =>
      sum(this.active().filter(r => r.responsible === p.display_name), r => r.invested)));
    return this.profiles().map(p => {
      const mine = this.active().filter(r => r.responsible === p.display_name);
      const invested = sum(mine, r => r.invested);
      return {
        profile: p,
        weeks: mine.length,
        plays: sum(mine, r => r.plays_count),
        invested,
        won: sum(mine, r => r.won),
        share: invested / maxInv,
      };
    });
  });

  protected readonly recent = computed(() => [...this.active()].reverse().slice(0, 6));

  // ---- Gráfico acumulado -------------------------------------------------
  protected readonly chart = { w: W, h: H };

  private readonly points = computed<ChartPoint[]>(() => {
    let inv = 0, won = 0;
    return this.active().map((r, i) => ({ x: i, inv: (inv += r.invested), won: (won += r.won) }));
  });

  private readonly maxY = computed(() => niceMax(Math.max(1, ...this.points().flatMap(p => [p.inv, p.won]))));

  protected readonly yTicks = computed(() => {
    const m = this.maxY();
    return [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: m * f, y: this.sy(m * f) }));
  });

  protected readonly invPath = computed(() => this.path(p => p.inv));
  protected readonly wonPath = computed(() => this.path(p => p.won));
  protected readonly invArea = computed(() => this.area(p => p.inv));
  protected readonly wonArea = computed(() => this.area(p => p.won));

  protected readonly lastDots = computed(() => {
    const pts = this.points();
    if (!pts.length) return null;
    const last = pts[pts.length - 1];
    const x = pts.length === 1 ? W - PAD.r : this.sx(last.x);
    return { x, inv: this.sy(last.inv), won: this.sy(last.won) };
  });

  protected readonly xLabels = computed(() => {
    const a = this.active();
    if (!a.length) return [];
    const idx = a.length === 1 ? [0] : [0, Math.floor((a.length - 1) / 2), a.length - 1];
    return [...new Set(idx)].map((i, k, all) => ({
      x: this.sx(i),
      label: a[i].week_start,
      anchor: all.length > 1 && k === 0 ? 'start' : all.length > 1 && k === all.length - 1 ? 'end' : 'middle',
    }));
  });

  async ngOnInit(): Promise<void> {
    this.timer = setInterval(() => this.now.set(new Date()), 30_000);
    try {
      const [rows, profiles, week] = await Promise.all([
        this.svc.getWeekly(), this.weekSvc.getProfiles(), this.weekSvc.ensureWeek(),
      ]);
      this.rows.set(rows);
      this.profiles.set(profiles);
      this.week.set(week);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private sx(i: number): number {
    const n = Math.max(this.points().length - 1, 1);
    return PAD.l + (i / n) * (W - PAD.l - PAD.r);
  }

  private sy(v: number): number {
    return H - PAD.b - (v / this.maxY()) * (H - PAD.t - PAD.b);
  }

  private path(get: (p: ChartPoint) => number): string {
    const pts = this.points();
    if (!pts.length) return '';
    if (pts.length === 1) return `M${PAD.l},${this.sy(get(pts[0]))}H${W - PAD.r}`;
    return pts.map((p, i) => `${i ? 'L' : 'M'}${this.sx(p.x).toFixed(1)},${this.sy(get(p)).toFixed(1)}`).join('');
  }

  private area(get: (p: ChartPoint) => number): string {
    const line = this.path(get);
    if (!line) return '';
    const base = H - PAD.b;
    const lastX = this.points().length === 1 ? W - PAD.r : this.sx(this.points().length - 1);
    return `${line}L${lastX},${base}L${PAD.l},${base}Z`;
  }
}

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((s, x) => s + f(x), 0);
}

function niceMax(v: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}
