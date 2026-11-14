import { Component, input } from '@angular/core';

/**
 * Loader en línea: las tres bolas del trébol botando en secuencia.
 * Usa currentColor, así que hereda el color del botón. Decorativo: el texto del botón
 * («Guardando…») sigue siendo lo que anuncian los lectores de pantalla.
 */
@Component({
  selector: 'app-loader',
  template: `<i></i><i></i><i></i>`,
  host: { 'aria-hidden': 'true', '[style.--d]': 'size()' },
  styles: `
    :host { --d: 0.45rem; display: inline-flex; align-items: center; gap: calc(var(--d) * 0.55); height: calc(var(--d) * 2.2); }
    i {
      width: var(--d); height: var(--d); border-radius: 50%;
      background: currentColor;
      animation: ld-bounce 0.9s cubic-bezier(0.3, 0, 0.3, 1) infinite;
    }
    i:nth-child(2) { animation-delay: 0.12s; opacity: 0.85; }
    i:nth-child(3) { animation-delay: 0.24s; opacity: 0.7; }
    @keyframes ld-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(calc(var(--d) * -0.9)); }
    }
    @media (prefers-reduced-motion: reduce) {
      i { animation: ld-fade 1.2s linear infinite !important; }
      @keyframes ld-fade { 50% { opacity: 0.3; } }
    }
  `,
})
export class LoaderComponent {
  readonly size = input('0.45rem');
}
