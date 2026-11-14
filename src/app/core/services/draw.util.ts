/** Próximo sorteo de Euromillones: martes y viernes a las 21:00 (hora peninsular). */
export function nextDraw(from = new Date()): Date {
  for (let i = 0; i < 8; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    d.setHours(21, 0, 0, 0);
    const day = d.getDay(); // 2 = martes, 5 = viernes
    if ((day === 2 || day === 5) && d > from) return d;
  }
  return from;
}

export function countdown(target: Date, now = new Date()): { d: number; h: number; m: number } {
  const ms = Math.max(0, target.getTime() - now.getTime());
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
  };
}
