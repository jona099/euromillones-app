import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { ToastService } from '../../shared/toast/toast.service';

const CHECK_EVERY = 30 * 60_000;

/**
 * Avisa cuando el service worker ha descargado una versión nueva y permite aplicarla
 * sin tener que cerrar y abrir la PWA dos veces. Busca actualizaciones al volver a la app
 * y cada 30 min mientras está abierta.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly sw = inject(SwUpdate);
  private readonly toasts = inject(ToastService);
  private readonly doc = inject(DOCUMENT);
  private notified = false;

  start(): void {
    if (!this.sw.isEnabled) return;   // en desarrollo el SW está desactivado

    this.sw.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.notify());

    // Si el SW quedó en un estado roto (caché borrada a medias), lo único sensato es recargar
    this.sw.unrecoverable.subscribe(() => this.doc.location.reload());

    const check = () => { this.sw.checkForUpdate().catch(() => { /* sin conexión */ }); };
    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.visibilityState === 'visible') check();
    });
    setInterval(check, CHECK_EVERY);
  }

  private notify(): void {
    if (this.notified) return;
    this.notified = true;
    this.toasts.show('Hay una versión nueva de Trébol.', {
      tone: 'info',
      duration: null,
      action: {
        label: 'Actualizar',
        icon: 'refresh',
        run: () => {
          this.sw.activateUpdate().finally(() => this.doc.location.reload());
        },
      },
    });
  }
}
