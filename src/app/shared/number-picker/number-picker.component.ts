import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Selector de bolas reutilizable (sirve para números y para estrellas).
 * Se integra con Reactive Forms vía ControlValueAccessor; el valor es number[].
 */
@Component({
  selector: 'app-number-picker',
  templateUrl: './number-picker.component.html',
  styleUrl: './number-picker.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumberPickerComponent), multi: true },
  ],
})
export class NumberPickerComponent implements ControlValueAccessor {
  readonly max = input.required<number>();
  readonly pick = input.required<number>();
  readonly variant = input<'ball' | 'star'>('ball');
  readonly label = input('');

  protected readonly selected = signal<number[]>([]);
  protected readonly disabled = signal(false);
  protected readonly options = computed(() => Array.from({ length: this.max() }, (_, i) => i + 1));
  protected readonly full = computed(() => this.selected().length >= this.pick());

  private onChange: (v: number[]) => void = () => {};
  private onTouched: () => void = () => {};

  protected isSelected(n: number): boolean {
    return this.selected().includes(n);
  }

  protected toggle(n: number): void {
    if (this.disabled()) return;
    const cur = this.selected();
    if (cur.includes(n)) {
      this.emit(cur.filter(x => x !== n));
    } else if (!this.full()) {
      this.emit([...cur, n]);
    }
    this.onTouched();
  }

  randomize(): void {
    const pool = this.options().slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.emit(pool.slice(0, this.pick()));
    this.onTouched();
  }

  protected clear(): void {
    this.emit([]);
  }

  private emit(v: number[]): void {
    const sorted = [...v].sort((a, b) => a - b);
    this.selected.set(sorted);
    this.onChange(sorted);
  }

  // ControlValueAccessor
  writeValue(v: number[] | null): void { this.selected.set(v ? [...v] : []); }
  registerOnChange(fn: (v: number[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }
}
