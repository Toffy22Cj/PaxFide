'use client';
// Ref: plan-fase7-pantallas.md A-1, D-P2–D-P4; sistema-visual-paxfide-web-enmienda-1.md §3.3 (R-F1–R-F7).
// Ilustración decorativa: aria-hidden, fuera del orden de foco, detrás del contenido; no comunica estados (R-F5).
import React, { useEffect, useRef } from 'react';
import { CityRenderer } from './cityDraw';
import { clampDpr, createCityScene, stepCityScene, type DistrictKey } from './cityScene';
import { loopMode } from './animationPreference';
import s from './background.module.css';

/** 1 si el tema efectivo es oscuro (D-P4). Con el claro forzado (DF7-17) siempre es 0. */
function nightFor(root: HTMLElement): number {
  const th = root.getAttribute('data-theme');
  if (th === 'dark') return 1;
  if (th === 'light') return 0;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
}

export function CityBackground({ paused, district = 'welcome' }: { paused: boolean; district?: DistrictKey }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const districtRef = useRef(district);
  const wakeRef = useRef<() => void>(() => {});
  const setDistrictRef = useRef<(d: DistrictKey) => void>(() => {});
  pausedRef.current = paused;
  districtRef.current = district;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext('2d')) return;
    const scene = createCityScene();
    const renderer = new CityRenderer(canvas, scene);
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf: number | null = null;
    let last = performance.now();
    let worldTime = 0;
    let night = nightFor(document.documentElement);
    let frames = 0;

    renderer.setDistrict(districtRef.current, true);

    const paint = () => {
      renderer.draw(night, worldTime);
      frames++;
      canvas.setAttribute('data-frames', String(frames));
      const cam = renderer.getCam();
      canvas.setAttribute('data-district', renderer.getDistrict());
      canvas.setAttribute('data-cam-x', cam.x.toFixed(2));
      canvas.setAttribute('data-cam-y', cam.y.toFixed(2));
      canvas.setAttribute('data-cam-k', cam.k.toFixed(2));
    };
    const tick = (now: number) => {
      raf = null;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      worldTime += dt;
      night += (nightFor(document.documentElement) - night) * Math.min(1, dt * 4);
      renderer.updateCamera(dt, reduceMq.matches, worldTime);
      stepCityScene(scene, dt);
      paint();
      if (loopMode(current()) === 'animate') raf = requestAnimationFrame(tick);
    };
    const current = () => ({ paused: pausedRef.current, reducedMotion: reduceMq.matches, hidden: document.hidden });
    const sync = () => {
      const mode = loopMode(current());
      canvas.setAttribute('data-loop', mode);
      if (mode === 'animate') {
        if (raf === null) { last = performance.now(); raf = requestAnimationFrame(tick); }
        return;
      }
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      if (mode === 'still') { night = nightFor(document.documentElement); paint(); }
    };
    const resize = () => {
      renderer.resize(window.innerWidth, window.innerHeight, clampDpr(window.devicePixelRatio));
      if (loopMode(current()) !== 'off') paint();
    };

    setDistrictRef.current = (nextDistrict: DistrictKey) => {
      renderer.setDistrict(nextDistrict, reduceMq.matches);
      if (loopMode(current()) === 'still') paint();
    };

    wakeRef.current = sync;
    resize();
    sync();
    const themeMq = window.matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    themeMq.addEventListener('change', sync);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', sync);
    reduceMq.addEventListener('change', sync);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      observer.disconnect();
      themeMq.removeEventListener('change', sync);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      reduceMq.removeEventListener('change', sync);
      wakeRef.current = () => {};
      setDistrictRef.current = () => {};
    };
  }, []);

  useEffect(() => { wakeRef.current(); }, [paused]);
  useEffect(() => { setDistrictRef.current(district); }, [district]);

  return <canvas ref={canvasRef} className={s.city} aria-hidden="true" data-testid="city-background" />;
}
