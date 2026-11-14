import { Component, input } from '@angular/core';

/** Logo Trébol: tres bolas (los tres amigos) formando un trébol con una estrella en el centro. */
@Component({
  selector: 'app-logo',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="11" r="9" fill="#12b76a" />
      <circle cx="11" cy="26" r="9" fill="#0fa45e" />
      <circle cx="29" cy="26" r="9" fill="#17c777" />
      <path d="M20 15.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" fill="#f5b915" />
    </svg>
    @if (withText()) {
      <span class="word">Trébol</span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 0.55rem; }
    .word { font-weight: 800; font-size: 1.3rem; letter-spacing: -0.03em; }
  `,
})
export class LogoComponent {
  readonly size = input(32);
  readonly withText = input(true);
}
