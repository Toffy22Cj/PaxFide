'use client';

import { useEffect, useState } from 'react';

/**
 * Instante UTC del backend mostrado en hora local (consecuencia 7 de `diseno-ux` §1). En SSR se pinta la fecha UTC
 * (AAAA-MM-DD) y tras montar se sustituye por la local, para no romper la hidratación entre zonas horarias.
 */
export function LocalDate({ iso, withTime = false, compact = false }: { iso: string; withTime?: boolean; compact?: boolean }) {
  const [text, setText] = useState(iso.slice(0, withTime ? 16 : 10).replace('T', ' '));
  useEffect(() => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    // `compact` (tablas, plan-fase7-puesta-al-dia.md P-3; paxfide-panel.html "18 oct · 3:40 p. m.")
    if (compact) {
      const day = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(d).replace('.', '');
      setText(withTime ? `${day} · ${new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' }).format(d)}` : day);
      return;
    }
    setText(new Intl.DateTimeFormat('es', withTime ? { dateStyle: 'long', timeStyle: 'short' } : { dateStyle: 'long' }).format(d));
  }, [iso, withTime, compact]);
  return <time dateTime={iso}>{text}</time>;
}
