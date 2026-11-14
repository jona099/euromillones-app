import { Component, computed, input } from '@angular/core';

export type SkeletonVariant = 'line' | 'circle' | 'block';

/**
 * Pieza de skeleton con shimmer. Los colores salen de --sk-base / --sk-shine,
 * así que dentro de .pattern-night se adapta solo al fondo oscuro.
 * Es decorativo (aria-hidden): el contenedor de la página pone aria-busy y el texto para lectores.
 */
@Component({
  selector: 'app-skeleton',
  template: '',
  host: {
    'aria-hidden': 'true',
    class: 'sk',
    '[class.sk-line]': "variant() === 'line'",
    '[class.sk-circle]': "variant() === 'circle'",
    '[class.sk-block]': "variant() === 'block'",
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.border-radius]': 'radius()',
  },
  styles: `
    :host {
      display: block;
      flex-shrink: 0;
      background: var(--sk-base);
      background-image: linear-gradient(90deg, transparent 0, var(--sk-shine) 50%, transparent 100%);
      background-size: 200% 100%;
      background-repeat: no-repeat;
      animation: sk-shimmer 1.4s ease-in-out infinite;
    }
    :host(.sk-line) { border-radius: 999px; }
    :host(.sk-circle) { border-radius: 50%; }
    :host(.sk-block) { border-radius: var(--radius-sm); }
    @keyframes sk-shimmer {
      from { background-position: 150% 0; }
      to { background-position: -50% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; background-image: none; }
    }
  `,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('line');
  /** Ancho CSS ('60%', '8rem'…). En círculos, si no se da alto, se usa el mismo. */
  readonly w = input<string>('100%');
  readonly h = input<string | null>(null);
  readonly r = input<string | null>(null);

  protected readonly width = computed(() => this.w());
  protected readonly height = computed(() =>
    this.h() ?? (this.variant() === 'circle' ? this.w() : this.variant() === 'line' ? '0.85rem' : '4rem'));
  protected readonly radius = computed(() => this.r());
}
