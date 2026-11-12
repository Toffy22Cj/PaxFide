'use client';
// Ref: paxfide-linea-tiempo.html (.truck, .truck-cargo-tag, createTruckForAsset). El camión del seguimiento: caja con
// el corazón y el QR, cabina, ruedas que giran y humo mientras conduce, y la etiqueta de su carga encima.
import React from 'react';
import s from './truck.module.css';

export function TruckGraphic({ tag, driving, facing = 'right', size = 'md' }: {
  /** La carga (el lote), encima del camión. */
  tag?: string;
  driving: boolean;
  facing?: 'left' | 'right';
  size?: 'md' | 'sm';
}) {
  return (
    <span className={s.truck} data-driving={driving ? 'true' : 'false'} data-facing={facing} data-size={size} aria-hidden="true">
      {tag && <span className={s.tag}>{tag}</span>}
      <span className={s.vehicle}>
        <span className={s.puff} /><span className={s.puff} />
        <svg viewBox="0 0 66 42" focusable="false">
          <g className={s.body}>
            <rect x="2" y="8" width="38" height="22" rx="3" className={s.box} />
            <rect x="2" y="8" width="38" height="5" rx="2" className={s.trim} />
            <path d="M15 24.5c-3-2-4.2-3.7-3.5-5.2.6-1.2 2-1.1 3.5.4 1.4-1 2.8-.6 3.3.8.6 1.5-.5 2.9-3.3 4z" className={s.ink} />
            <rect x="25" y="15" width="9" height="9" rx="1" className={s.qr} />
            <rect x="26.5" y="16.5" width="3" height="3" className={s.ink} />
            <rect x="30" y="20" width="2.5" height="2.5" className={s.ink} />
            <path d="M40 14h12l9 9v7H40z" className={s.cab} />
            <path d="M43 16h8l6 6h-14z" className={s.window} />
            <rect x="0" y="29" width="63" height="3" rx="1.5" className={s.cab} />
          </g>
          <g className={s.wheel}><circle cx="14" cy="34" r="6" className={s.tyre} /><circle cx="14" cy="34" r="2.2" className={s.hub} /></g>
          <g className={s.wheel}><circle cx="51" cy="34" r="6" className={s.tyre} /><circle cx="51" cy="34" r="2.2" className={s.hub} /></g>
        </svg>
      </span>
    </span>
  );
}
