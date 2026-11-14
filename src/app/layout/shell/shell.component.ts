import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { WeekService, toIsoDate } from '../../core/services/week.service';
import { PlaysService } from '../../core/services/plays.service';
import { nextDraw } from '../../core/services/draw.util';
import { LogoComponent } from '../../shared/brand/logo.component';
import { AvatarComponent } from '../../shared/brand/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';

const DISMISS_KEY = 'trebol.banner.dismissed';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe, LogoComponent, AvatarComponent, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly weeks = inject(WeekService);
  private readonly plays = inject(PlaysService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly links = [
    { path: '/dashboard', label: 'Resumen', icon: 'home' },
    { path: '/jugadas', label: 'Jugadas', icon: 'ticket' },
    { path: '/premios', label: 'Premios', icon: 'trophy' },
    { path: '/historial', label: 'Historial', icon: 'history' },
    { path: '/pena', label: 'Peña', icon: 'users' },
  ];

  private readonly myTurn = signal(false);
  private readonly playsThisWeek = signal<number | null>(null);
  private readonly dismissed = signal(readDismissed());
  private readonly onPlaysPage = signal(false);
  protected readonly draw = signal(nextDraw());

  /** Banner: es mi turno, no hay jugadas esta semana y no lo he cerrado hoy. */
  protected readonly showBanner = computed(() =>
    this.myTurn() && this.playsThisWeek() === 0 && !this.dismissed() && !this.onPlaysPage());

  ngOnInit(): void {
    void this.refresh();
    // Re-evaluar al navegar (p. ej. tras apuntar jugadas y volver al resumen)
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(e => {
        this.onPlaysPage.set((e as NavigationEnd).urlAfterRedirects.startsWith('/jugadas'));
        void this.refresh();
      });
  }

  protected dismiss(): void {
    try { localStorage.setItem(DISMISS_KEY, toIsoDate(new Date())); } catch { /* modo privado */ }
    this.dismissed.set(true);
  }

  private async refresh(): Promise<void> {
    await this.auth.ready;
    try {
      const draw = nextDraw();
      const week = await this.weeks.ensureWeek(draw);
      this.myTurn.set(week.responsible_id === this.auth.profile()?.id);
      this.playsThisWeek.set((await this.plays.getByWeek(week.id)).length);
      this.draw.set(draw);
    } catch (e) {
      console.error('No se pudo comprobar el turno', e);
    }
  }
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === toIsoDate(new Date());
  } catch {
    return false;
  }
}
