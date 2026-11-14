import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LogoComponent } from '../../shared/brand/logo.component';
import { AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, AvatarComponent, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly links = [
    { path: '/dashboard', label: 'Resumen', icon: 'home' },
    { path: '/jugadas', label: 'Jugadas', icon: 'ticket' },
    { path: '/premios', label: 'Premios', icon: 'trophy' },
  ];
}
