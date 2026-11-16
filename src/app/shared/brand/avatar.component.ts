import { Component, computed, input } from '@angular/core';

export const AVATAR_COLORS = ['#4f6bff', '#ff7a45', '#12b76a'];

/** Avatar con inicial; el color depende del turno para que cada amigo sea siempre reconocible. */
@Component({
  selector: 'app-avatar',
  template: `{{ initial() }}`,
  host: {
    '[style.background]': 'color()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.42',
  },
  styles: `
    :host {
      display: inline-grid; place-items: center; flex: none;
      border-radius: 50%; color: #fff; font-weight: 800;
      box-shadow: 0 0 0 2px var(--surface);
    }
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly order = input(0);
  readonly size = input(36);
  protected readonly initial = computed(() => this.name().charAt(0).toUpperCase());
  protected readonly color = computed(() => AVATAR_COLORS[this.order() % AVATAR_COLORS.length]);
}
