import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { TicketPhoto } from '../models';

const BUCKET = 'tickets';
// Límites de redimensionado: el lado largo admite capturas de pantalla altas (TuLotero)
// sin que la letra pequeña deje de leerse.
const MAX_LONG = 2600;
const MAX_SHORT = 1300;
const MAX_FILE_MB = 10;

/** Tipos admitidos al adjuntar: imágenes (fotos y capturas) y PDF. */
export const TICKET_ACCEPT = 'image/*,application/pdf';

export const isPdf = (path: string): boolean => path.toLowerCase().endsWith('.pdf');

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
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      throw new Error(`El archivo supera los ${MAX_FILE_MB} MB`);
    }
    const { blob, ext, type } = await prepare(file);
    const path = `${weekId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await this.db.storage
      .from(BUCKET).upload(path, blob, { contentType: type });
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

/** Decide cómo subir cada archivo: PDF tal cual; imágenes recomprimidas a JPEG. */
async function prepare(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return { blob: file, ext: 'pdf', type: 'application/pdf' };
  }
  if (!file.type.startsWith('image/')) throw new Error('Solo se admiten imágenes o PDF');
  try {
    return { blob: await compress(file), ext: 'jpg', type: 'image/jpeg' };
  } catch {
    // Formatos que el navegador no sabe decodificar (p. ej. HEIC fuera de Safari): se sube el original
    const ext = file.name.split('.').pop()?.toLowerCase() || 'img';
    return { blob: file, ext, type: file.type };
  }
}

/** Redimensiona y recomprime en el navegador: una foto de móvil pasa de ~4 MB a ~300-500 KB. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const long = Math.max(bitmap.width, bitmap.height);
  const short = Math.min(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_LONG / long, MAX_SHORT / short);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';   // las capturas PNG con transparencia no quedan en negro
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85));
}
