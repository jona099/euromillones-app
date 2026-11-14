import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NumberPickerComponent } from '../../shared/number-picker/number-picker.component';
import { ComboComponent } from '../../shared/combo/combo.component';
import { PrizesService } from '../../core/services/prizes.service';
import { AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PlaysService } from '../../core/services/plays.service';
import { WeekService, toIsoDate } from '../../core/services/week.service';
import { AuthService } from '../../core/services/auth.service';
import { Play, Profile, Week } from '../../core/models';

const exactLength = (n: number) => (c: AbstractControl<number[]>): ValidationErrors | null =>
  c.value?.length === n ? null : { exactLength: n };

@Component({
  selector: 'app-plays',
  imports: [ReactiveFormsModule, NumberPickerComponent, ComboComponent, AvatarComponent, IconComponent, DatePipe, CurrencyPipe],
  templateUrl: './plays.component.html',
  styleUrl: './plays.component.scss',
})
export class PlaysComponent implements OnInit {
  private readonly playsSvc = inject(PlaysService);
  private readonly weekSvc = inject(WeekService);
  private readonly prizesSvc = inject(PrizesService);
  protected readonly auth = inject(AuthService);

  protected readonly offset = signal(0);            // 0 = semana actual
  protected readonly week = signal<Week | null>(null);
  protected readonly plays = signal<Play[]>([]);
  protected readonly profiles = signal<Profile[]>([]);
  /** play_id -> importe total premiado */
  protected readonly prizeByPlay = signal<Map<number, number>>(new Map());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly responsible = computed(() =>
    this.profiles().find(p => p.id === this.week()?.responsible_id) ?? null);
  protected readonly responsibleName = computed(() => this.responsible()?.display_name ?? '—');
  protected readonly isMyTurn = computed(() =>
    !!this.week() && this.week()!.responsible_id === this.auth.profile()?.id);
  protected readonly total = computed(() =>
    this.plays().reduce((s, p) => s + Number(p.price), 0));

  /** Martes y viernes de la semana seleccionada. */
  protected readonly drawDates = computed(() => {
    const w = this.week();
    if (!w) return [];
    const monday = new Date(`${w.week_start}T00:00:00`);
    return [1, 4].map(d => {
      const x = new Date(monday);
      x.setDate(x.getDate() + d);
      return toIsoDate(x);
    });
  });

  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly form = this.fb.group({
    draw_date: this.fb.control('', Validators.required),
    numbers: this.fb.control<number[]>([], exactLength(5)),
    stars: this.fb.control<number[]>([], exactLength(2)),
  });

  async ngOnInit(): Promise<void> {
    this.profiles.set(await this.weekSvc.getProfiles());
    await this.load();
  }

  async move(delta: number): Promise<void> {
    this.offset.update(o => o + delta);
    await this.load();
  }

  async save(): Promise<void> {
    const w = this.week();
    if (!w || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const play = await this.playsSvc.create({ week_id: w.id, ...this.form.getRawValue() });
      this.plays.update(list => [...list, play]);
      this.form.patchValue({ numbers: [], stars: [] });
      this.form.markAsUntouched();
    } catch (e) {
      this.error.set('No se pudo guardar la jugada. Revisa la conexión e inténtalo de nuevo.');
      console.error(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(play: Play): Promise<void> {
    if (!confirm('¿Eliminar esta jugada? Se borrarán también sus premios.')) return;
    await this.playsSvc.delete(play.id);
    this.plays.update(list => list.filter(p => p.id !== play.id));
  }

  protected profileOf(id?: string): Profile | undefined {
    return this.profiles().find(p => p.id === id);
  }

  protected playsOn(date: string): Play[] {
    return this.plays().filter(p => p.draw_date === date);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() + this.offset() * 7);
      const week = await this.weekSvc.ensureWeek(d);
      this.week.set(week);
      const plays = await this.playsSvc.getByWeek(week.id);
      this.plays.set(plays);
      const prizes = await this.prizesSvc.getByPlays(plays.map(p => p.id));
      const map = new Map<number, number>();
      prizes.forEach(pr => map.set(pr.play_id, (map.get(pr.play_id) ?? 0) + Number(pr.amount)));
      this.prizeByPlay.set(map);
      this.selectDefaultDraw();
    } finally {
      this.loading.set(false);
    }
  }

  /** Preselecciona el próximo sorteo (o el último si ya pasaron los dos). */
  private selectDefaultDraw(): void {
    const today = toIsoDate(new Date());
    const dates = this.drawDates();
    this.form.controls.draw_date.setValue(dates.find(d => d >= today) ?? dates[dates.length - 1]);
  }
}
