import { Injectable, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { VAPID_PUBLIC_KEY } from '../push.config';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

/** Alta y baja de este dispositivo en las notificaciones push de la peña. */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly sw = inject(SwPush);
  private readonly db = inject(SupabaseService).client;

  readonly state = signal<PushState>('off');

  constructor() {
    if (!this.sw.isEnabled || !('Notification' in window) || VAPID_PUBLIC_KEY.startsWith('PEGA_')) {
      this.state.set('unsupported');
      return;
    }
    if (Notification.permission === 'denied') this.state.set('denied');
    this.sw.subscription.subscribe(sub => {
      if (Notification.permission === 'denied') this.state.set('denied');
      else this.state.set(sub ? 'on' : 'off');
      // Re-sincroniza por si la fila se borró (p. ej. al limpiar suscripciones caducadas)
      if (sub) void this.save(sub);
    });
  }

  async enable(): Promise<void> {
    const sub = await this.sw.requestSubscription({ serverPublicKey: VAPID_PUBLIC_KEY });
    await this.save(sub);
    this.state.set('on');
  }

  async disable(): Promise<void> {
    const sub = await firstValueFrom(this.sw.subscription);
    if (sub) {
      await this.db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await this.sw.unsubscribe();
    }
    this.state.set('off');
  }

  private async save(sub: PushSubscription): Promise<void> {
    const j = sub.toJSON();
    const { error } = await this.db.from('push_subscriptions').upsert(
      { endpoint: sub.endpoint, p256dh: j.keys?.['p256dh'], auth: j.keys?.['auth'] },
      { onConflict: 'endpoint' },
    );
    if (error) console.error('No se pudo guardar la suscripción push', error);
  }
}
