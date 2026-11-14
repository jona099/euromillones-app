import { Component } from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/** Skeleton de una jugada: 5 bolas + 2 estrellas, con el mismo tamaño que app-combo (--ball). */
@Component({
  selector: 'app-skeleton-combo',
  imports: [SkeletonComponent],
  template: `
    @for (i of balls; track i) { <app-skeleton variant="circle" w="var(--ball, 2rem)" /> }
    <span class="sep"></span>
    @for (i of stars; track i) { <app-skeleton class="star" variant="block" w="var(--ball, 2rem)" h="var(--ball, 2rem)" r="0" /> }
  `,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host { display: inline-flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
    .sep { width: 0.15rem; }
    .star { clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
  `,
})
export class SkeletonComboComponent {
  protected readonly balls = [0, 1, 2, 3, 4];
  protected readonly stars = [0, 1];
}
