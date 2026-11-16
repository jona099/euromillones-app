import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Resumen',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'jugadas',
        title: 'Jugadas',
        loadComponent: () => import('./features/plays/plays.component').then(m => m.PlaysComponent),
      },
      {
        path: 'turnos',
        title: 'Turnos',
        loadComponent: () => import('./features/turns/turns.component').then(m => m.TurnsComponent),
      },
      {
        path: 'premios',
        title: 'Premios',
        loadComponent: () => import('./features/prizes/prizes.component').then(m => m.PrizesComponent),
      },
      {
        path: 'historial',
        title: 'Historial',
        loadComponent: () => import('./features/history/history.component').then(m => m.HistoryComponent),
      },
      {
        path: 'pena',
        title: 'La peña',
        loadComponent: () => import('./features/pena/pena.component').then(m => m.PenaComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
