'use client';
// Ref: plan-fase7-pantallas.md A-2, D-P1–D-P5; plan-fase7-fidelidad.md D-F2; sistema-visual-paxfide-web-enmienda-1.md §3.3 (R-F1–R-F7).
// Ilustración decorativa: aria-hidden, fuera del orden de foco, detrás del contenido; no comunica estados (R-F5).
// La guía el scroll de la landing: cada bloque marcado con `data-world-view` es una vista del recorrido.
import React, { useEffect, useRef } from 'react';
import { WorldRenderer } from './worldDraw';
import { clampDpr, createWorldScene, viewForScroll, type ScreenRect } from './worldScene';
import { calculateNightVal, type WorldMode } from './worldMode';
import { loopMode } from '../background/animationPreference';
import { usePausedPreference } from '../background/usePausedPreference';
import s from './world.module.css';

/** Vista objetivo según el scroll: el centro de la ventana frente al centro de cada bloque del recorrido. */
export function targetView(): number {
  if (typeof document === 'undefined') return 0;
  const centers = [...document.querySelectorAll<HTMLElement>('[data-world-view]')].map((el) => {
    const r = el.getBoundingClientRect();
    return r.top + window.scrollY + r.height / 2;
  });
  return viewForScroll(centers, window.scrollY + window.innerHeight / 2);
}

/** Bloques de contenido a la vista (marcados con `data-world-avoid`): las nubes no se dibujan por detrás (R-F1). */
function contentRects(): ScreenRect[] {
  if (typeof document === 'undefined') return [];
  const h = window.innerHeight;
  return [...document.querySelectorAll<HTMLElement>('[data-world-avoid]')].map((el) => el.getBoundingClientRect())
    .filter((r) => r.bottom > 0 && r.top < h && r.width > 0)
    .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
}

export interface WorldSceneProps {
  mode?: WorldMode;
  onViewChange?: (view: number) => void;
}

export function WorldScene({ mode = 'auto', onViewChange }: WorldSceneProps) {
  const paused = usePausedPreference();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const modeRef = useRef<WorldMode>(mode);
  const onViewChangeRef = useRef(onViewChange);
  const wakeRef = useRef<() => void>(() => {});

  pausedRef.current = paused;
  modeRef.current = mode;
  onViewChangeRef.current = onViewChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext('2d')) return;
    const renderer = new WorldRenderer(canvas, createWorldScene());
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf: number | null = null;
    let last = performance.now();
    let worldTime = 0;
    let view = targetView();
    let target = view;
    let painted: number | null = null;
    let frames = 0;
    const current = () => ({ paused: pausedRef.current, reducedMotion: reduceMq.matches, hidden: document.hidden });

    const paint = (drift: boolean) => {
      const night = calculateNightVal(modeRef.current, view);
      renderer.draw(view, night, worldTime, drift, contentRects());
      painted = view;
      frames++;
      canvas.setAttribute('data-frames', String(frames));
      canvas.setAttribute('data-view', view.toFixed(2));
      canvas.setAttribute('data-night', night.toFixed(2));
      canvas.setAttribute('data-mode', modeRef.current);
      onViewChangeRef.current?.(view);
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
      if (painted !== view) paint(false);
    };

    const sync = () => {
      const loop = loopMode(current());
      canvas.setAttribute('data-loop', loop);
      if (loop === 'animate') {
        if (raf === null) { last = performance.now(); raf = requestAnimationFrame(tick); }
        return;
      }
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      painted = null;
      if (loop === 'still') still();
    };

    const onScroll = () => {
      target = targetView();
      if (loopMode(current()) === 'still') still();
    };

    const resize = () => {
      renderer.resize(window.innerWidth, window.innerHeight, clampDpr(window.devicePixelRatio));
      target = targetView();
      const loop = loopMode(current());
      if (loop === 'still') { painted = null; still(); }
    };

    wakeRef.current = sync;
    resize();
    sync();

    const themeMq = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    themeMq.addEventListener('change', sync);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    reduceMq.addEventListener('change', sync);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      observer.disconnect();
      themeMq.removeEventListener('change', sync);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      reduceMq.removeEventListener('change', sync);
      wakeRef.current = () => {};
    };
  }, []);

  useEffect(() => { wakeRef.current(); }, [paused, mode]);

  return <canvas ref={canvasRef} className={s.world} aria-hidden="true" data-testid="world-background" />;
}
