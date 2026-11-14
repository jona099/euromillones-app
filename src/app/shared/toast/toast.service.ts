import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastAction {
  label: string;
  icon?: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  /** ms; null = no se cierra solo */
  duration: number | null;
}

/**
 * Avisos efímeros. Además gestiona los borrados con "Deshacer": la eliminación real
 * se aplaza hasta que el aviso caduca, y si se pulsa Deshacer simplemente no se ejecuta.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  /** Borrados pendientes de confirmar: se ejecutan si se cierra la pestaña. */
  private readonly pending = new Map<number, () => void>();

  readonly toasts = signal<Toast[]>([]);

  constructor() {
    globalThis.addEventListener?.('pagehide', () => this.flush());
  }

  show(message: string, opts: { tone?: ToastTone; action?: ToastAction; duration?: number | null } = {}): number {
    const id = ++this.seq;
    const toast: Toast = {
      id,
      message,
      tone: opts.tone ?? 'success',
      action: opts.action,
      duration: opts.duration === undefined ? (opts.action ? 6000 : 3500) : opts.duration,
    };
    // Máximo 3 a la vez: el más antiguo se va
    this.toasts.update(list => [...list, toast].slice(-3));
    if (toast.duration) this.timers.set(id, setTimeout(() => this.dismiss(id), toast.duration));
    return id;
  }

  success(message: string): void { this.show(message); }
  error(message: string): void { this.show(message, { tone: 'error', duration: 6000 }); }

  /**
   * Borrado con Deshacer.
   * - `hide` quita el elemento de la UI al momento.
   * - `commit` hace el borrado real cuando caduca el aviso.
   * - `restore` lo devuelve a la UI si se deshace o si falla el borrado.
   */
  undoable(message: string, cfg: { hide: () => void; restore: () => void; commit: () => Promise<unknown> }): void {
    cfg.hide();
    let undone = false;
    const run = async () => {
      this.pending.delete(id);
      if (undone) return;
      try {
        await cfg.commit();
      } catch (e) {
        console.error(e);
        cfg.restore();
        this.error('No se pudo eliminar. Revisa la conexión.');
      }
    };
    const id = this.show(message, {
      tone: 'info',
      action: {
        label: 'Deshacer',
        icon: 'undo',
        run: () => {
          undone = true;
          this.pending.delete(id);
          cfg.restore();
        },
      },
    });
    this.pending.set(id, run);
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update(list => list.filter(t => t.id !== id));
    this.pending.get(id)?.();
  }

  act(t: Toast): void {
    t.action?.run();
    this.dismiss(t.id);
  }

  private flush(): void {
    for (const run of [...this.pending.values()]) run();
  }
}
