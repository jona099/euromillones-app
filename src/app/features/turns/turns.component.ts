import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { CalendarDay, TurnsData, TurnsService, mondayOf, monthGrid, responsibleFor } from '../../core/services/turns.service';
import { toIsoDate } from '../../core/services/week.service';
import { AVATAR_COLORS, AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { delayedLoading } from '../../shared/skeleton/delayed-loading';
import { ToastService } from '../../shared/toast/toast.service';
import { Profile } from '../../core/models';

/** Meses visibles hacia delante desde el actual (2 años). */
const MONTHS_AHEAD = 24;

@Component({
  selector: 'app-turns',
  imports: [DatePipe, AvatarComponent, IconComponent, SkeletonComponent],
  templateUrl: './turns.component.html',
  styleUrl: './turns.component.scss',
})
export class TurnsComponent implements OnInit {
  private readonly svc = inject(TurnsService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly data = signal<TurnsData | null>(null);
  protected readonly loading = signal(true);
  protected readonly skeleton = delayedLoading(this.loading);
  protected readonly error = signal(false);

  private readonly today = new Date();
  private readonly thisMonday = mondayOf(this.today);
  /** Desplazamiento en meses respecto al actual: 0..MONTHS_AHEAD. */
  protected readonly offset = signal(0);
  protected readonly maxOffset = MONTHS_AHEAD;

  protected readonly month = computed(() =>
    new Date(this.today.getFullYear(), this.today.getMonth() + this.offset(), 1));
  protected readonly grid = computed(() => {
    const d = this.data();
    const m = this.month();
    return d ? monthGrid(m.getFullYear(), m.getMonth(), d, this.today) : [];
  });

  protected readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  protected readonly legendOpen = signal(false);

  /** Semana seleccionada (ISO del lunes) y modo intercambio. */
  protected readonly selected = signal<string | null>(toIsoDate(this.thisMonday));
  protected readonly swapping = signal(false);
  protected readonly busy = signal(false);

  protected readonly selectedInfo = computed(() => {
    const iso = this.selected();
    const d = this.data();
    if (!iso || !d) return null;
    const monday = parseIso(iso);
    const sunday = addDays(monday, 6);
    return {
      monday, sunday,
      tue: addDays(monday, 1), fri: addDays(monday, 4),
      who: responsibleFor(monday, d),
      past: monday < this.thisMonday,
      current: iso === toIsoDate(this.thisMonday),
    };
  });

  /** Próximos turnos de cada uno (resumen bajo el calendario). */
  protected readonly nextTurns = computed(() => {
    const d = this.data();
    if (!d) return [];
    return d.profiles.map(p => {
      let next: Date | null = null;
      let count = 0;
      const end = new Date(this.today.getFullYear(), this.today.getMonth() + MONTHS_AHEAD + 1, 0);
      for (let m = new Date(this.thisMonday); m <= end; m = addDays(m, 7)) {
        if (responsibleFor(m, d)?.id === p.id) { count++; next ??= new Date(m); }
      }
      return { profile: p, next, count };
    });
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected color(p?: Profile): string {
    return p ? AVATAR_COLORS[p.turn_order % AVATAR_COLORS.length] : 'transparent';
  }

  protected isMine(p?: Profile): boolean {
    return !!p && p.id === this.auth.profile()?.id;
  }

  protected go(delta: number): void {
    this.offset.update(o => Math.min(this.maxOffset, Math.max(0, o + delta)));
  }

  protected goToday(): void {
    this.offset.set(0);
    this.selected.set(toIsoDate(this.thisMonday));
    this.swapping.set(false);
  }

  protected pick(day: CalendarDay): void {
    if (!this.swapping()) {
      this.selected.set(day.monday);
      return;
    }
    void this.swapWith(day);
  }

  private async swapWith(day: CalendarDay): Promise<void> {
    const from = this.selectedInfo();
    if (!from || this.busy()) return;
    const target = parseIso(day.monday);
    if (target < this.thisMonday) {
      this.toast.error('No se pueden cambiar semanas pasadas.');
      return;
    }
    if (day.who?.id === from.who?.id) {
      this.toast.error('Esa semana ya es del mismo turno. Elige otra.');
      return;
    }
    this.busy.set(true);
    try {
      await this.svc.swap(from.monday, target);
      await this.reload();
      this.swapping.set(false);
      this.selected.set(day.monday);
      const a = from.who?.display_name ?? '?', b = day.who?.display_name ?? '?';
      this.toast.show(`Turnos cambiados: ${a} ↔ ${b}`, {
        action: { label: 'Deshacer', icon: 'undo', run: () => void this.undo(from.monday, target) },
      });
    } catch (e) {
      console.error(e);
      this.toast.error('No se pudo cambiar el turno.');
    } finally {
      this.busy.set(false);
    }
  }

  private async undo(a: Date, b: Date): Promise<void> {
    try {
      await this.svc.swap(a, b);
      await this.reload();
    } catch {
      this.toast.error('No se pudo deshacer el cambio.');
    }
  }

  private async reload(): Promise<void> {
    try {
      this.data.set(await this.svc.load());
      this.error.set(false);
    } catch (e) {
      console.error(e);
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}
