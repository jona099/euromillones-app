import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { IconComponent } from '../icon/icon.component';

const ICON = { success: 'check', info: 'bell', error: 'x' } as const;

/** Pila de avisos. Abajo en el centro; en móvil, por encima de la tabbar. */
@Component({
  selector: 'app-toast-host',
  imports: [IconComponent],
  template: `
    <div class="stack" role="status" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="t.tone">
          <span class="ico" aria-hidden="true"><app-icon [name]="icon[t.tone]" [size]="15" /></span>
          <p>{{ t.message }}</p>
          @if (t.action; as a) {
            <button type="button" class="act" (click)="toasts.act(t)">
              @if (a.icon) { <app-icon [name]="a.icon" [size]="15" /> }
              {{ a.label }}
            </button>
          }
          <button type="button" class="close" (click)="toasts.dismiss(t.id)" aria-label="Cerrar aviso">
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed; z-index: 60;
      left: 50%; bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%);
      display: grid; gap: 0.5rem; justify-items: center;
      width: min(26rem, calc(100vw - 2rem));
      pointer-events: none;
    }
    @media (max-width: 760px) {
      .stack { bottom: calc(5.4rem + env(safe-area-inset-bottom, 0px)); }
    }
    .toast {
      pointer-events: auto;
      display: flex; align-items: center; gap: 0.6rem;
      width: 100%;
      padding: 0.55rem 0.5rem 0.55rem 0.7rem;
      border-radius: 0.9rem;
      background: #0f1a36; color: #eef2fb;
      border: 1px solid rgb(255 255 255 / 0.08);
      box-shadow: 0 12px 32px -12px rgb(0 0 0 / 0.55);
      animation: toast-in 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.1);
    }
    @keyframes toast-in { from { opacity: 0; transform: translateY(12px) scale(0.97); } }
    p { margin: 0; flex: 1; font-size: 0.9rem; font-weight: 600; line-height: 1.35; }
    .ico {
      display: grid; place-items: center; flex: none;
      width: 1.6rem; height: 1.6rem; border-radius: 50%;
      background: rgb(var(--accent-rgb) / 0.22); color: rgb(var(--accent-rgb));
    }
    .info .ico { background: rgb(255 255 255 / 0.1); color: #fff; }
    .error .ico { background: rgb(255 107 112 / 0.2); color: #ff8589; }
    button {
      display: inline-flex; align-items: center; gap: 0.3rem;
      border: 0; font: inherit; cursor: pointer; flex: none;
    }
    .act {
      padding: 0.4rem 0.75rem; border-radius: 999px;
      background: rgb(255 255 255 / 0.12); color: #fff;
      font-size: 0.85rem; font-weight: 800;
    }
    .act:active { background: rgb(255 255 255 / 0.2); }
    .close {
      justify-content: center; width: 1.9rem; height: 1.9rem; border-radius: 50%;
      background: transparent; color: rgb(255 255 255 / 0.6);
    }
    @media (hover: hover) and (pointer: fine) {
      .act:hover { background: rgb(255 255 255 / 0.2); }
      .close:hover { color: #fff; background: rgb(255 255 255 / 0.08); }
    }
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly icon = ICON;
}
