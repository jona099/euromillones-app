import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { Profile } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly db = inject(SupabaseService).client;
  private readonly router = inject(Router);

  private readonly _session = signal<Session | null>(null);
  private readonly _profile = signal<Profile | null>(null);

  readonly session = this._session.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly isLoggedIn = computed(() => this._session() !== null);

  /** Se resuelve una vez recuperada la sesión persistida (lo espera el guard). */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.db.auth
      .getSession()
      .then(({ data }) => this.setSession(data.session));

    this.db.auth.onAuthStateChange((_event, session) => {
      void this.setSession(session);
    });
  }

  async login(email: string, password: string): Promise<string | null> {
    const { error } = await this.db.auth.signInWithPassword({ email, password });
    if (!error) return null;
    return error.message === 'Invalid login credentials'
      ? 'Email o contraseña incorrectos.'
      : error.message;
  }

  async logout(): Promise<void> {
    await this.db.auth.signOut();
    await this.router.navigate(['/login']);
  }

  private async setSession(session: Session | null): Promise<void> {
    this._session.set(session);
    if (!session) {
      this._profile.set(null);
      return;
    }
    const { data } = await this.db
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single<Profile>();
    this._profile.set(data);
  }
}
