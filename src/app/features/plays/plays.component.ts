import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NumberPickerComponent } from '../../shared/number-picker/number-picker.component';
import { ComboComponent } from '../../shared/combo/combo.component';
import { AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PlaysService } from '../../core/services/plays.service';
import { PrizesService } from '../../core/services/prizes.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { PhotosService } from '../../core/services/photos.service';
import { WeekService, toIsoDate } from '../../core/services/week.service';
import { nextDraw } from '../../core/services/draw.util';
import { AuthService } from '../../core/services/auth.service';
import { Favorite, Play, Profile, TicketPhoto, Week } from '../../core/models';

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
  private readonly prizesSvc = inject(PrizesService);
  private readonly favSvc = inject(FavoritesService);
  private readonly photoSvc = inject(PhotosService);
  private readonly weekSvc = inject(WeekService);
  protected readonly auth = inject(AuthService);

  private readonly formEl = viewChild<ElementRef<HTMLElement>>('formEl');

  protected readonly offset = signal(0);
  protected readonly week = signal<Week | null>(null);
  protected readonly plays = signal<Play[]>([]);
  protected readonly profiles = signal<Profile[]>([]);
  protected readonly favorites = signal<Favorite[]>([]);
  protected readonly photos = signal<TicketPhoto[]>([]);
  protected readonly prizeByPlay = signal<Map<number, number>>(new Map());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly editing = signal<Play | null>(null);
  protected readonly preview = signal<TicketPhoto | null>(null);
  protected readonly namingFavorite = signal(false);

  protected readonly responsible = computed(() =>
    this.profiles().find(p => p.id === this.week()?.responsible_id) ?? null);
  protected readonly responsibleName = computed(() => this.responsible()?.display_name ?? '—');
  protected readonly isMyTurn = computed(() =>
    !!this.week() && this.week()!.responsible_id === this.auth.profile()?.id);
  protected readonly total = computed(() => this.plays().reduce((s, p) => s + Number(p.price), 0));

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
  protected readonly favName = this.fb.control('', [Validators.required, Validators.maxLength(30)]);

  async ngOnInit(): Promise<void> {
    const [profiles, favorites] = await Promise.all([this.weekSvc.getProfiles(), this.favSvc.getAll()]);
    this.profiles.set(profiles);
    this.favorites.set(favorites);
    await this.load();
  }

  async move(delta: number): Promise<void> {
    this.cancelEdit();
    this.offset.update(o => o + delta);
    await this.load();
  }

  // ---------------- Guardar / editar ----------------
  async save(): Promise<void> {
    const w = this.week();
    if (!w || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const value = this.form.getRawValue();
      const editing = this.editing();
      if (editing) {
        const updated = await this.playsSvc.update(editing.id, value);
        this.plays.update(list => list.map(p => (p.id === updated.id ? updated : p)));
      } else {
        const play = await this.playsSvc.create({ week_id: w.id, ...value });
        this.plays.update(list => [...list, play]);
      }
      this.resetForm();
    } catch (e) {
      this.error.set('No se pudo guardar la jugada. Revisa la conexión e inténtalo de nuevo.');
      console.error(e);
    } finally {
      this.saving.set(false);
    }
  }

  edit(play: Play): void {
    this.editing.set(play);
    this.form.setValue({ draw_date: play.draw_date, numbers: [...play.numbers], stars: [...play.stars] });
    this.formEl()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  cancelEdit(): void {
    if (!this.editing()) return;
    this.resetForm();
  }

  async remove(play: Play): Promise<void> {
    if (!confirm('¿Eliminar esta jugada? Se borrarán también sus premios.')) return;
    await this.playsSvc.delete(play.id);
    this.plays.update(list => list.filter(p => p.id !== play.id));
    if (this.editing()?.id === play.id) this.resetForm();
  }

  // ---------------- Favoritas ----------------
  useFavorite(f: Favorite): void {
    this.form.patchValue({ numbers: [...f.numbers], stars: [...f.stars] });
    this.form.markAsDirty();
  }

  async saveFavorite(): Promise<void> {
    const { numbers, stars } = this.form.getRawValue();
    if (this.favName.invalid || numbers.length !== 5 || stars.length !== 2) return;
    const fav = await this.favSvc.create({ name: this.favName.value.trim(), numbers, stars });
    this.favorites.update(list => [...list, fav]);
    this.favName.reset();
    this.namingFavorite.set(false);
  }

  async removeFavorite(f: Favorite, ev: Event): Promise<void> {
    ev.stopPropagation();
    if (!confirm(`¿Quitar "${f.name}" de favoritas?`)) return;
    await this.favSvc.delete(f.id);
    this.favorites.update(list => list.filter(x => x.id !== f.id));
  }

  // ---------------- Fotos del boleto ----------------
  async onFiles(input: HTMLInputElement): Promise<void> {
    const w = this.week();
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!w || !files.length) return;
    this.uploading.set(true);
    this.error.set(null);
    try {
      for (const f of files) await this.photoSvc.upload(w.id, f);
      this.photos.set(await this.photoSvc.getByWeek(w.id));
    } catch (e) {
      this.error.set('No se pudo subir la foto. Prueba con otra imagen.');
      console.error(e);
    } finally {
      this.uploading.set(false);
    }
  }

  async removePhoto(p: TicketPhoto): Promise<void> {
    if (!confirm('¿Eliminar esta foto del boleto?')) return;
    await this.photoSvc.delete(p);
    this.photos.update(list => list.filter(x => x.id !== p.id));
    this.preview.set(null);
  }

  // ---------------- Helpers ----------------
  protected profileOf(id?: string): Profile | undefined {
    return this.profiles().find(p => p.id === id);
  }

  protected playsOn(date: string): Play[] {
    return this.plays().filter(p => p.draw_date === date);
  }

  private resetForm(): void {
    const date = this.form.controls.draw_date.value;
    this.editing.set(null);
    this.form.reset({ draw_date: date, numbers: [], stars: [] });
    this.namingFavorite.set(false);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const d = nextDraw();   // a partir del sábado, ya es la semana siguiente
      d.setDate(d.getDate() + this.offset() * 7);
      const week = await this.weekSvc.ensureWeek(d);
      this.week.set(week);

      const [plays, photos] = await Promise.all([
        this.playsSvc.getByWeek(week.id),
        this.photoSvc.getByWeek(week.id).catch(() => [] as TicketPhoto[]),
      ]);
      this.plays.set(plays);
      this.photos.set(photos);

      const prizes = await this.prizesSvc.getByPlays(plays.map(p => p.id));
      const map = new Map<number, number>();
      prizes.forEach(pr => map.set(pr.play_id, (map.get(pr.play_id) ?? 0) + Number(pr.amount)));
      this.prizeByPlay.set(map);

      this.selectDefaultDraw();
    } finally {
      this.loading.set(false);
    }
  }

  private selectDefaultDraw(): void {
    const today = toIsoDate(new Date());
    const dates = this.drawDates();
    this.form.controls.draw_date.setValue(dates.find(d => d >= today) ?? dates[dates.length - 1]);
  }
}
