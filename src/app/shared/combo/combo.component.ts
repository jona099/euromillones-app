import { Component, input } from '@angular/core';

@Component({
  selector: 'app-combo',
  template: `
    @for (n of numbers(); track n) { <span class="b" [class.hl]="n === highlight()">{{ n }}</span> }
    <span class="sep" aria-hidden="true"></span>
    @for (s of stars(); track s) { <span class="s">{{ s }}</span> }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
    .b, .s {
      display: grid; place-items: center;
      width: var(--ball, 2rem); height: var(--ball, 2rem);
      font-weight: 800; font-size: 0.82rem;
    }
    .b {
      border-radius: 50%; color: var(--ball-ink);
      background: radial-gradient(circle at 35% 30%, var(--ball-hi) 0 30%, var(--ball-lo) 75%);
      box-shadow: inset 0 0 0 1.5px var(--ball-line);
    }
    .b.hl { background: var(--accent-fill); color: var(--on-accent); box-shadow: none; }
    .sep { width: 0.15rem; }
    .s {
      background: var(--gold); color: var(--ball-ink);
      clip-path: polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
      padding-top: 0.2rem; font-size: 0.68rem;
    }
  `,
})
export class ComboComponent {
  readonly numbers = input.required<number[]>();
  readonly stars = input.required<number[]>();
  readonly highlight = input<number | null>(null);
}
