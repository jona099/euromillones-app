import { Signal, effect, signal, untracked } from '@angular/core';

/**
 * Evita el parpadeo del skeleton: solo se muestra si `loading` dura más de `delay` ms
 * y, si llega a mostrarse, se mantiene al menos `min` ms. Llamar en contexto de inyección.
 *
 * Uso en plantilla:
 *   @if (skeleton()) { …skeleton… } @else if (!loading()) { …contenido… }
 */
export function delayedLoading(loading: Signal<boolean>, delay = 150, min = 300): Signal<boolean> {
  const show = signal(false);
  let shownAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  effect(onCleanup => {
    const isLoading = loading();
    untracked(() => {
      clearTimeout(timer);
      if (isLoading) {
        if (!show()) {
          timer = setTimeout(() => { shownAt = performance.now(); show.set(true); }, delay);
        }
      } else if (show()) {
        const left = min - (performance.now() - shownAt);
        if (left > 0) timer = setTimeout(() => show.set(false), left);
        else show.set(false);
      }
    });
    onCleanup(() => clearTimeout(timer));
  });

  return show.asReadonly();
}
