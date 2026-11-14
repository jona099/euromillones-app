import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PRIZE_CATEGORIES, PrizeWithPlay, PrizesService } from '../../core/services/prizes.service';
import { PlaysService } from '../../core/services/plays.service';
import { ComboComponent } from '../../shared/combo/combo.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { Play } from '../../core/models';

@Component({
  selector: 'app-prizes',
  imports: [ReactiveFormsModule, ComboComponent, IconComponent, CurrencyPipe, DatePipe],
  templateUrl: './prizes.component.html',
  styleUrl: './prizes.component.scss',
})
export class PrizesComponent implements OnInit {
  private readonly prizesSvc = inject(PrizesService);
  private readonly playsSvc = inject(PlaysService);
  private readonly fb = inject(FormBuilder);

  protected readonly categories = PRIZE_CATEGORIES;
  protected readonly prizes = signal<PrizeWithPlay[]>([]);
  protected readonly plays = signal<Play[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly totalWon = computed(() =>
    this.prizes().reduce((s, p) => s + Number(p.amount), 0));

  protected readonly biggest = computed(() =>
    this.prizes().reduce((m, p) => Math.max(m, Number(p.amount)), 0));

  protected readonly form = this.fb.group({
    play_id: this.fb.control<number | null>(null, Validators.required),
    category: this.fb.control<string | null>(null),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
  });

  async ngOnInit(): Promise<void> {
    try {
      const [prizes, plays] = await Promise.all([this.prizesSvc.getAll(), this.playsSvc.getRecent()]);
      this.prizes.set(prizes);
      this.plays.set(plays);
    } finally {
      this.loading.set(false);
    }
  }

  protected selectPlay(id: number): void {
    this.form.controls.play_id.setValue(id);
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const { play_id, category, amount } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.prizesSvc.create({ play_id: play_id!, category, amount: amount! });
      this.prizes.set(await this.prizesSvc.getAll());
      this.form.reset();
    } catch (e) {
      this.error.set('No se pudo guardar el premio. Inténtalo de nuevo.');
      console.error(e);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(prize: PrizeWithPlay): Promise<void> {
    if (!confirm('¿Eliminar este premio?')) return;
    await this.prizesSvc.delete(prize.id);
    this.prizes.update(list => list.filter(p => p.id !== prize.id));
  }
}
