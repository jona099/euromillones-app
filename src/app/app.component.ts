import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet,
} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <div class="nav-progress" [class.on]="progress()" [class.done]="done()" aria-hidden="true"></div>
    <router-outlet />
  `,
  styles: `
    .nav-progress {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      height: 3px; pointer-events: none;
      background: linear-gradient(90deg, var(--clover), var(--gold));
      box-shadow: 0 0 8px rgb(18 183 106 / 0.6);
      transform-origin: 0 50%;
      transform: scaleX(0);
      opacity: 0;
    }
    /* Avanza rápido al principio y se frena cerca del final (nunca llega sola al 100 %). */
    .nav-progress.on { opacity: 1; transform: scaleX(0.85); transition: transform 8s cubic-bezier(0.1, 0.7, 0.2, 1); }
    .nav-progress.done { opacity: 0; transform: scaleX(1); transition: transform 0.2s ease-out, opacity 0.3s 0.2s; }
  `,
})
export class AppComponent {
  private readonly doc = inject(DOCUMENT);
  protected readonly progress = signal(false);
  protected readonly done = signal(false);

  constructor() {
    const router = inject(Router);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;

    const sub = router.events.subscribe(e => {
      if (e instanceof NavigationStart) {
        clearTimeout(timer);
        this.done.set(false);
        // Solo si la navegación tarda (descarga de un chunk lazy); las instantáneas no pintan nada
        timer = setTimeout(() => this.progress.set(true), 120);
      } else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        clearTimeout(timer);
        if (this.progress()) {
          this.progress.set(false);
          this.done.set(true);
        }
        if (first) {
          first = false;
          this.hideBoot();
        }
      }
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** Retira el loader inline de index.html con un fade. */
  private hideBoot(): void {
    const boot = this.doc.getElementById('boot');
    if (!boot) return;
    boot.classList.add('out');
    setTimeout(() => boot.remove(), 400);
  }
}
