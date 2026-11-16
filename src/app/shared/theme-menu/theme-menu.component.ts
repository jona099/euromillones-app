import { Component, ElementRef, inject, signal } from '@angular/core';
import { PushService } from '../../core/services/push.service';
import { ACCENTS, ThemeMode, ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../toast/toast.service';
import { IconComponent } from '../icon/icon.component';

/** Botón de la topbar que abre el panel de apariencia: modo (claro/oscuro/sistema) y acento. */
@Component({
  selector: 'app-theme-menu',
  imports: [IconComponent],
  host: {
    '(document:click)': 'onDocClick($event)',
    '(document:keydown.escape)': 'close(true)',
  },
  template: `
    <button #trigger type="button" class="trigger" (click)="open.set(!open())"
            [attr.aria-expanded]="open()" aria-controls="theme-panel" aria-label="Apariencia y avisos">
      <app-icon name="palette" [size]="18" />
    </button>

    @if (open()) {
      <div id="theme-panel" class="panel" role="dialog" aria-label="Apariencia">
        <p class="title">Modo</p>
        <div class="seg" role="radiogroup" aria-label="Modo de color">
          @for (m of modes; track m.id) {
            <button type="button" role="radio" [attr.aria-checked]="theme.mode() === m.id"
                    [class.on]="theme.mode() === m.id" (click)="setMode(m.id)">
              <app-icon [name]="m.icon" [size]="16" /> {{ m.label }}
            </button>
          }
        </div>

        <p class="title">Color</p>
        <div class="accents" role="radiogroup" aria-label="Color de acento">
          @for (a of accents; track a.id) {
            <button type="button" role="radio" class="accent" [attr.aria-checked]="theme.accent() === a.id"
                    [class.on]="theme.accent() === a.id" (click)="theme.setAccent(a.id)">
              <span class="swatch" [style.--sw]="a.swatch" aria-hidden="true">
                <i></i><i></i><i></i>
              </span>
              {{ a.label }}
            </button>
          }
        </div>

        <p class="title push-title">Avisos</p>
        @switch (push.state()) {
          @case ('unsupported') { <p class="hint">Instala la app en la pantalla de inicio para recibir avisos.</p> }
          @case ('denied') { <p class="hint">Has bloqueado las notificaciones. Actívalas en los ajustes del navegador.</p> }
          @default {
            <button type="button" class="push" role="switch" [attr.aria-checked]="push.state() === 'on'"
                    [class.on]="push.state() === 'on'" [disabled]="pushBusy()" (click)="togglePush()">
              <app-icon name="bell" [size]="16" />
              <span>Jugadas, premios y recordatorio</span>
              <i class="sw" aria-hidden="true"></i>
            </button>
          }
        }
      </div>
    }
  `,
  styles: `
    :host { position: relative; }
    .trigger {
      display: grid; place-items: center;
      width: 2.25rem; height: 2.25rem;
      border: 0; border-radius: 50%;
      background: transparent; color: var(--muted); cursor: pointer;
    }
    .trigger[aria-expanded='true'], .trigger:active { background: var(--wash); color: var(--heading); }
    @media (hover: hover) and (pointer: fine) { .trigger:hover { background: var(--wash); color: var(--heading); } }

    .panel {
      position: absolute; top: calc(100% + 0.5rem); right: 0; z-index: 40;
      width: min(18rem, calc(100vw - 2rem));
      padding: 1rem;
      border: 1px solid var(--line); border-radius: var(--radius);
      background: var(--surface); box-shadow: var(--shadow), 0 18px 40px -20px rgb(0 0 0 / 0.35);
      transform-origin: top right;
      animation: pop 0.16s cubic-bezier(0.2, 0.8, 0.3, 1);
    }
    @keyframes pop { from { opacity: 0; transform: scale(0.96) translateY(-4px); } }

    .title { margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
    .title + * { margin-bottom: 1rem; }
    .accents { margin-bottom: 0 !important; }

    .seg {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem;
      padding: 0.25rem; border-radius: 0.8rem; background: var(--surface-alt);
    }
    .seg button {
      display: grid; justify-items: center; gap: 0.15rem;
      padding: 0.45rem 0.25rem; border: 0; border-radius: 0.6rem;
      background: transparent; color: var(--muted);
      font: inherit; font-size: 0.75rem; font-weight: 700; cursor: pointer;
    }
    .seg button.on { background: var(--surface); color: var(--heading); box-shadow: var(--shadow); }

    .accents { display: grid; gap: 0.35rem; }
    .accent {
      display: flex; align-items: center; gap: 0.7rem;
      padding: 0.5rem 0.6rem; border: 1.5px solid var(--line); border-radius: 0.8rem;
      background: var(--surface); color: var(--heading);
      font: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; text-align: left;
    }
    .accent.on { border-color: var(--clover); background: var(--clover-soft); }
    .push-title { margin-top: 1rem; }
    .hint { margin: 0; font-size: 0.82rem; color: var(--muted); }
    .push {
      display: flex; align-items: center; gap: 0.6rem; width: 100%;
      padding: 0.55rem 0.6rem; border: 1.5px solid var(--line); border-radius: 0.8rem;
      background: var(--surface); color: var(--heading);
      font: inherit; font-size: 0.86rem; font-weight: 700; cursor: pointer; text-align: left;
    }
    .push span { flex: 1; }
    .push:disabled { opacity: 0.6; cursor: progress; }
    .sw { position: relative; width: 2.2rem; height: 1.3rem; border-radius: 999px; background: var(--line-strong); transition: background 0.15s; flex: none; }
    .sw::after { content: ''; position: absolute; top: 0.15rem; left: 0.15rem; width: 1rem; height: 1rem; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.25); transition: transform 0.15s; }
    .push.on .sw { background: var(--clover); }
    .push.on .sw::after { transform: translateX(0.9rem); }
    .swatch { display: inline-flex; }
    .swatch i {
      width: 1.05rem; height: 1.05rem; border-radius: 50%;
      background: var(--sw); box-shadow: 0 0 0 2px var(--surface);
    }
    .swatch i + i { margin-left: -0.35rem; }
    .swatch i:nth-child(2) { filter: brightness(0.85); }
    .swatch i:nth-child(3) { background: var(--gold); }
  `,
})
export class ThemeMenuComponent {
  protected readonly theme = inject(ThemeService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly push = inject(PushService);
  private readonly toast = inject(ToastService);
  protected readonly pushBusy = signal(false);
  protected readonly open = signal(false);
  protected readonly accents = ACCENTS;
  protected readonly modes: { id: ThemeMode; label: string; icon: string }[] = [
    { id: 'light', label: 'Claro', icon: 'sun' },
    { id: 'dark', label: 'Oscuro', icon: 'moon' },
    { id: 'system', label: 'Sistema', icon: 'monitor' },
  ];

  protected setMode(mode: ThemeMode): void {
    this.theme.setMode(mode);
  }

  protected async togglePush(): Promise<void> {
    this.pushBusy.set(true);
    try {
      if (this.push.state() === 'on') {
        await this.push.disable();
        this.toast.success('Avisos desactivados en este dispositivo');
      } else {
        await this.push.enable();
        this.toast.success('Avisos activados en este dispositivo');
      }
    } catch (e) {
      console.error(e);
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') this.push.state.set('denied');
      else this.toast.error('No se pudieron cambiar los avisos.');
    } finally {
      this.pushBusy.set(false);
    }
  }

  protected onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  protected close(refocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.host.nativeElement.querySelector<HTMLButtonElement>('.trigger')?.focus();
  }
}
