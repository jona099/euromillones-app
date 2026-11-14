import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TicketPhoto } from '../models';

const BUCKET = 'tickets';
const MAX_SIDE = 1600;   // px: suficiente para leer el boleto y ligero de subir

@Injectable({ providedIn: 'root' })
export class PhotosService {
  private readonly db = inject(SupabaseService).client;

  /** Fotos de una semana con URL firmada (bucket privado, 1 h de validez). */
  async getByWeek(weekId: number): Promise<TicketPhoto[]> {
    const { data, error } = await this.db
      .from('ticket_photos').select('*').eq('week_id', weekId).order('created_at');
    if (error) throw error;
    const photos = data as TicketPhoto[];
    if (!photos.length) return [];

    const { data: signed } = await this.db.storage
      .from(BUCKET).createSignedUrls(photos.map(p => p.path), 3600);
    return photos.map((p, i) => ({ ...p, url: signed?.[i]?.signedUrl ?? undefined }));
  }

  async upload(weekId: number, file: File): Promise<void> {
    const blob = await compress(file);
    const path = `${weekId}/${crypto.randomUUID()}.jpg`;

    const { error: upErr } = await this.db.storage
      .from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
    if (upErr) throw upErr;

    const { error } = await this.db.from('ticket_photos').insert({ week_id: weekId, path });
    if (error) {
      await this.db.storage.from(BUCKET).remove([path]);   // no dejar huérfanos
      throw error;
    }
  }

  async delete(photo: TicketPhoto): Promise<void> {
    await this.db.storage.from(BUCKET).remove([photo.path]);
    const { error } = await this.db.from('ticket_photos').delete().eq('id', photo.id);
    if (error) throw error;
  }
}

/** Redimensiona y recomprime en el navegador: una foto de móvil pasa de ~4 MB a ~300 KB. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.82));
}
