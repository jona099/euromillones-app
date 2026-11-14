import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Accent = 'trebol' | 'oceano' | 'rubi';

export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  { id: 'trebol', label: 'Trébol', swatch: '#12b76a' },
  { id: 'oceano', label: 'Océano', swatch: '#2e8cf0' },
  { id: 'rubi', label: 'Rubí', swatch: '#d6336c' },
];

/** Deben coincidir con el script inline de index.html (que aplica el tema antes de pintar). */
const MODE_KEY = 'trebol.theme';
const ACCENT_KEY = 'trebol.accent';
const BAR_COLOR = { light: '#ffffff', dark: '#131a2e' };

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* modo privado / almacenamiento bloqueado */ }
}

/**
 * Tema claro/oscuro/sistema + acento de color.
 * Pone data-theme (siempre resuelto a light|dark) y data-accent en <html>,
 * lo persiste y actualiza meta[name=theme-color].
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly media = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  readonly mode = signal<ThemeMode>(read(MODE_KEY, ['light', 'dark', 'system'] as const, 'system'));
  readonly accent = signal<Accent>(read(ACCENT_KEY, ['trebol', 'oceano', 'rubi'] as const, 'trebol'));
  private readonly systemDark = signal(this.media?.matches ?? false);

  constructor() {
    this.media?.addEventListener('change', e => this.systemDark.set(e.matches));

    effect(() => {
      const mode = this.mode();
      const resolved = mode === 'system' ? (this.systemDark() ? 'dark' : 'light') : mode;
      const html = this.doc.documentElement;
      html.dataset['theme'] = resolved;
      html.dataset['accent'] = this.accent();
      this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[resolved]);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    write(MODE_KEY, mode);
  }

  setAccent(accent: Accent): void {
    this.accent.set(accent);
    write(ACCENT_KEY, accent);
  }
}
