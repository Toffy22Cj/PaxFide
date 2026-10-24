'use client';
// Ref: plan-fase7-pantallas.md A-2, D-P1–D-P5; sistema-visual-paxfide-web-enmienda-1.md §3.3 (R-F1–R-F7);
// plan-fase7-fidelidad.md D-F2 (día y noche con el modo Auto / Noche / Día, no con el tema de la app), D-F4 (etiquetas
// del mapa) y F-A1 (desenfoque al llegar a las convocatorias, como `#world.blurred` del prototipo).
// Ilustración decorativa: aria-hidden, fuera del orden de foco, detrás del contenido; no comunica estados (R-F5).
// La guía el scroll de la landing: cada bloque marcado con `data-world-view` es una vista del recorrido. Con `fixedView`
// (el acceso, D-F5) la vista no sigue al scroll.
import React, { useEffect, useRef } from 'react';
import { WorldRenderer } from './worldDraw';
import { clampDpr, createWorldScene, scrollProgress, viewForScroll, type ScreenRect } from './worldScene';
import { getWorldNight, setWorldProgress, subscribeWorld } from './worldMode';
import { loopMode } from '../background/animationPreference';
import { usePausedPreference } from '../background/usePausedPreference';
import s from './world.module.css';

const getStorage = () => window.localStorage;

/** Centros verticales de los bloques del recorrido y el centro de la ventana. */
function scrollGeometry(): { centers: number[]; y: number } {
  const centers = [...document.querySelectorAll<HTMLElement>('[data-world-view]')].map((el) => {
    const r = el.getBoundingClientRect();
    return r.top + window.scrollY + r.height / 2;
  });
  return { centers, y: window.scrollY + window.innerHeight / 2 };
}

/** Bloques de contenido a la vista (marcados con `data-world-avoid`): las nubes no se dibujan por detrás (R-F1). */
function contentRects(): ScreenRect[] {
  const h = window.innerHeight;
  return [...document.querySelectorAll<HTMLElement>('[data-world-avoid]')].map((el) => el.getBoundingClientRect())
    .filter((r) => r.bottom > 0 && r.top < h && r.width > 0)
    .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
}

/** El bloque `blurUnder` ya asoma por la ventana (prototipo: su borde superior por encima del 82 % de la altura). */
function blurredBy(id: string | undefined): boolean {
  if (!id) return false;
  const el = document.getElementById(id);
  return !!el && el.getBoundingClientRect().top <= window.innerHeight * 0.82;
}

/** La familia de `--font-mono` (next/font la autoaloja, enmienda §6): el canvas no puede leer la variable CSS. */
function monoFamily(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'ui-monospace, monospace';
}

export function WorldScene({ fixedView, blurUnder }: { fixedView?: number; blurUnder?: string }) {
  const paused = usePausedPreference();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const wakeRef = useRef<() => void>(() => {});
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext('2d')) return;
    const renderer = new WorldRenderer(canvas, createWorldScene(), monoFamily());
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf: number | null = null;
    let last = performance.now();
    let worldTime = 0;
    const read = () => {
      if (fixedView !== undefined) { setWorldProgress(fixedView, reduceMq.matches); return fixedView; }
      const { centers, y } = scrollGeometry();
      setWorldProgress(scrollProgress(centers, y), reduceMq.matches);
      return viewForScroll(centers, y);
    };
    let target = read();
    let view = target;
    let painted: string | null = null;
    let frames = 0;
    const current = () => ({ paused: pausedRef.current, reducedMotion: reduceMq.matches, hidden: document.hidden });

    const paint = (drift: boolean) => {
      const night = getWorldNight(getStorage);
      renderer.draw(view, night, worldTime, drift, contentRects());
      painted = `${view}|${night}`;
      frames++;
      canvas.setAttribute('data-frames', String(frames));
      canvas.setAttribute('data-view', view.toFixed(2));
      canvas.setAttribute('data-night', night.toFixed(2));
    };
    const tick = (now: number) => {
      raf = null;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      worldTime += dt;
      view += (target - view) * Math.min(1, dt * 5.5);
      if (Math.abs(target - view) < 1e-4) view = target;
      paint(true);
      if (loopMode(current()) === 'animate') raf = requestAnimationFrame(tick);
    };
    /** Sin bucle (pausa o "reducir movimiento", R-F2 y R-F3): la vista salta de parada en parada, sin transición. */
    const still = () => {
      view = Math.round(target);
      if (painted !== `${view}|${getWorldNight(getStorage)}`) paint(false);
    };
    const blur = () => canvas.setAttribute('data-blurred', blurredBy(blurUnder) ? 'true' : 'false');
    const sync = () => {
      const mode = loopMode(current());
      canvas.setAttribute('data-loop', mode);
      if (mode === 'animate') {
        if (raf === null) { last = performance.now(); raf = requestAnimationFrame(tick); }
        return;
      }
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      painted = null;
      if (mode === 'still') still();
    };
    const onScroll = () => {
      target = read();
      blur();
      if (loopMode(current()) === 'still') still();
    };
    const resize = () => {
      renderer.resize(window.innerWidth, window.innerHeight, clampDpr(window.devicePixelRatio));
      target = read();
      blur();
      if (loopMode(current()) === 'still') { painted = null; still(); }
    };

    wakeRef.current = sync;
    resize();
    sync();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    reduceMq.addEventListener('change', onScroll);
    reduceMq.addEventListener('change', sync);
    // El modo Día / Noche: en marcha, cada fotograma lo lee; quieto, se repinta al cambiar (sin mezcla animada)
    const unsubscribe = subscribeWorld(() => { if (loopMode(current()) === 'still') still(); });
    return () => {
      unsubscribe();
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      reduceMq.removeEventListener('change', onScroll);
      reduceMq.removeEventListener('change', sync);
      wakeRef.current = () => {};
    };
  }, [fixedView, blurUnder]);

  useEffect(() => { wakeRef.current(); }, [paused]);

  return <canvas ref={canvasRef} className={s.world} aria-hidden="true" data-testid="world-background" data-blurred="false" />;
}
