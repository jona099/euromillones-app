import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LedgerService, PenaData, Settlement,
  computeBalances, computeFrequency, computeRanking, settle,
} from '../../core/services/ledger.service';
import { AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { Profile } from '../../core/models';

import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { delayedLoading } from '../../shared/skeleton/delayed-loading';

import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-pena',
  imports: [SkeletonComponent, LoaderComponent, ReactiveFormsModule, CurrencyPipe, DatePipe, PercentPipe, AvatarComponent, IconComponent],
  templateUrl: './pena.component.html',
  styleUrl: './pena.component.scss',
})
export class PenaComponent implements OnInit {
  private readonly ledger = inject(LedgerService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly data = signal<PenaData | null>(null);
  protected readonly loading = signal(true);
  /** Skeleton sin parpadeo: aparece tras 150 ms y dura al menos 300 ms. */
  protected readonly skeleton = delayedLoading(this.loading);
  protected readonly saving = signal(false);
  protected readonly showForm = signal(false);

  // ---- Cuentas ----
  protected readonly balances = computed(() => (this.data() ? computeBalances(this.data()!) : []));
  protected readonly settlements = computed(() => settle(this.balances()));
  protected readonly transfers = computed(() => this.data()?.transfers ?? []);
  protected readonly profiles = computed(() => this.data()?.profiles ?? []);

  // ---- Ranking ----
  protected readonly ranking = computed(() => (this.data() ? computeRanking(this.data()!) : []));
  protected readonly medals = ['🥇', '🥈', '🥉'];

  // ---- Números ----
  protected readonly freq = computed(() => computeFrequency(this.data()?.plays ?? []));
  protected readonly maxNum = computed(() => Math.max(1, ...this.freq().numbers));
  protected readonly maxStar = computed(() => Math.max(1, ...this.freq().stars));
  protected readonly range50 = Array.from({ length: 50 }, (_, i) => i + 1);
  protected readonly range12 = Array.from({ length: 12 }, (_, i) => i + 1);

  protected readonly hot = computed(() =>
    this.range50.map(n => ({ n, c: this.freq().numbers[n] }))
      .filter(x => x.c > 0)
      .sort((a, b) => b.c - a.c || a.n - b.n)
      .slice(0, 5));

  protected readonly never = computed(() => this.range50.filter(n => this.freq().numbers[n] === 0));

  protected readonly form = this.fb.group({
    from_id: this.fb.control<string | null>(null, Validators.required),
    to_id: this.fb.control<string | null>(null, Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    note: this.fb.control<string | null>(null),
  });

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected nameOf(id: string): Profile | undefined {
    return this.profiles().find(p => p.id === id);
  }

  /** Intensidad 0..1 para el mapa de calor. */
  protected heat(count: number, max: number): number {
    return count === 0 ? 0 : 0.15 + 0.85 * (count / max);
  }

  async markPaid(s: Settlement): Promise<void> {
    try {
      const t = await this.ledger.addTransfer({ from_id: s.from.id, to_id: s.to.id, amount: s.amount, note: 'Liquidación' });
      await this.reload();
      const amount = s.amount.toFixed(2).replace('.', ',');
      this.toast.show(`Apuntado: ${s.from.display_name} pagó ${amount} € a ${s.to.display_name}`, {
        action: { label: 'Deshacer', icon: 'undo', run: () => void this.undoTransfer(t.id) },
      });
    } catch (e) {
      console.error(e);
      this.toast.error('No se pudo apuntar el pago.');
    }
  }

  private async undoTransfer(id: number | undefined): Promise<void> {
    if (id == null) return;
    await this.ledger.deleteTransfer(id);
    await this.reload();
  }

  async saveTransfer(): Promise<void> {
    const v = this.form.getRawValue();
    if (this.form.invalid || v.from_id === v.to_id || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      await this.ledger.addTransfer({ from_id: v.from_id!, to_id: v.to_id!, amount: v.amount!, note: v.note || null });
      this.form.reset();
      this.showForm.set(false);
      await this.reload();
      this.toast.success('Pago guardado');
    } finally {
      this.saving.set(false);
    }
  }

  removeTransfer(id: number): void {
    const before = this.data();
    this.toast.undoable('Pago eliminado', {
      hide: () => this.data.update(d => (d ? { ...d, transfers: d.transfers.filter(t => t.id !== id) } : d)),
      restore: () => this.data.set(before),
      commit: async () => {
        await this.ledger.deleteTransfer(id);
        await this.reload();
      },
    });
  }

  private async reload(): Promise<void> {
    try {
      this.data.set(await this.ledger.load());
    } finally {
      this.loading.set(false);
    }
  }
}
