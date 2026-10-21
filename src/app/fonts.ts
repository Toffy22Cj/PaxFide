// Ref: prompts-agentes-estilo-v2.md §4 (fuentes autoalojadas) y VS-0; decisiones-delegadas-web-fase7.md DF7-04, DF7-05.
import localFont from 'next/font/local';

/**
 * Fuente de titulares. Autoalojada (nunca Google Fonts ni otro CDN), subconjunto latino, `font-display: swap`.
 * Sin preload mientras ninguna pantalla la use (DF7-05): se activa en la primera tarea que la ponga en pantalla.
 */
export const fontDisplay = localFont({
  src: './fonts/bricolage-grotesque-latin.woff2',
  weight: '600 800',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-display',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

/** Fuente monoespaciada (importes, referencias, huellas). Mismas reglas que `fontDisplay`. */
export const fontMono = localFont({
  src: './fonts/jetbrains-mono-latin.woff2',
  weight: '500 600',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-mono',
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
});
