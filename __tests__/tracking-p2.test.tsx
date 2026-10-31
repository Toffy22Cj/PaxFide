// Ref: plan-fase7-puesta-al-dia.md P-2 (tests); plan-fase7-fidelidad.md F-A5 y F-C2; referencia-api-v1.md §8 (G-2, G-3,
// G-4, E1.3, E1.4 y ADR-051 F6). Los vectores de `fixtures/merkle-proof-vectors.json` son una copia literal de
// `Toffy22Cj/Donaciones` `crypto/src/test/resources/merkle/proof-vectors.json` (el backend los genera).
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import vectors from './fixtures/merkle-proof-vectors.json';
import * as session from '../src/lib/auth/session';
import { parseTracking, parseTransition, type Transition } from '../src/lib/api/tracking';
import { explorerUrl, shortHash, verifyAnchorProof } from '../src/lib/tracking/merkle';
import { buildAssetTree } from '../src/lib/tracking/tree';
import { TrackingScreen } from '../src/screens/TrackingScreen';
import { snakeGeometry, stationDistance } from '../src/components/tracking/TrackingTimeline';

type Vector = { description: string; leaves: string[]; index: number; path: { side: 'LEFT' | 'RIGHT'; hash: string }[]; root: string };
const V = vectors as Vector[];
const flip = (h: string) => (h[0] === 'a' ? 'b' : 'a') + h.slice(1);

describe('Verificador de Merkle (E1.3) con los vectores del backend', () => {
  it.each(V.map((v) => [v.description, v] as const))('%s → coincide', async (_d, v) => {
    expect(await verifyAnchorProof(v.leaves[v.index], { merkleRoot: v.root, path: v.path })).toBe(true);
  });

  it('5 hojas con índice 4 (nivel impar: el último se combina consigo mismo) y con índice 2', async () => {
    const four = V.find((v) => v.description === '5 hojas, indice 4')!;
    const two = V.find((v) => v.description === '5 hojas, indice 2')!;
    expect(four.path[0]).toEqual({ side: 'RIGHT', hash: four.leaves[4] });
    expect(await verifyAnchorProof(four.leaves[4], { merkleRoot: four.root, path: four.path })).toBe(true);
    expect(await verifyAnchorProof(two.leaves[2], { merkleRoot: two.root, path: two.path })).toBe(true);
  });

  it('una prueba alterada, otra hoja, otro lado o un hash mal formado → no coincide (negativas)', async () => {
    const v = V.find((x) => x.description === '5 hojas, indice 2')!;
    expect(await verifyAnchorProof(v.leaves[2], { merkleRoot: v.root, path: v.path.map((p, i) => (i === 1 ? { ...p, hash: flip(p.hash) } : p)) })).toBe(false);
    expect(await verifyAnchorProof(v.leaves[1], { merkleRoot: v.root, path: v.path })).toBe(false);
    expect(await verifyAnchorProof(v.leaves[2], { merkleRoot: v.root, path: v.path.map((p, i) => (i === 0 ? { ...p, side: p.side === 'LEFT' ? 'RIGHT' : 'LEFT' } : p)) })).toBe(false);
    expect(await verifyAnchorProof(v.leaves[2].toUpperCase(), { merkleRoot: v.root, path: v.path })).toBe(false);
    expect(await verifyAnchorProof(v.leaves[2], { merkleRoot: flip(v.root), path: v.path })).toBe(false);
  });

  it('explorador solo para Sepolia y Amoy (tabla cerrada); otra red, sin enlace', () => {
    const tx = '0x' + 'ab'.repeat(32);
    expect(explorerUrl('sepolia', tx)).toBe(`https://sepolia.etherscan.io/tx/${tx}`);
    expect(explorerUrl('amoy', tx)).toBe(`https://amoy.polygonscan.com/tx/${tx}`);
    expect(explorerUrl('ganache-local', tx)).toBeNull();
    expect(explorerUrl('constructor', tx)).toBeNull();
    expect(explorerUrl('sepolia', 'javascript:alert(1)')).toBeNull();
    expect(shortHash('5c22aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa9f14')).toBe('5c22…9f14');
    expect(shortHash('sha256:' + 'c'.repeat(60) + 'dddd')).toBe('cccc…dddd');
  });
});

describe('Árbol de sublotes (G-4)', () => {
  it('el hijo cuelga de su padre; un padre ausente hace de raíz; nunca un ciclo', () => {
    const items = [
      { assetRef: 'A' }, { assetRef: 'B', parentAssetRef: 'A' }, { assetRef: 'C', parentAssetRef: 'B' },
      { assetRef: 'D', parentAssetRef: 'NO-ESTA' }, { assetRef: 'E', parentAssetRef: 'F' }, { assetRef: 'F', parentAssetRef: 'E' },
      { assetRef: 'G', parentAssetRef: 'G' },
    ];
    const roots = buildAssetTree(items);
    const shape = (n: ReturnType<typeof buildAssetTree>[number]): unknown => ({ [n.item.assetRef]: n.children.map(shape) });
    expect(roots.map((r) => r.item.assetRef)).toEqual(['A', 'D', 'E', 'F', 'G']);
    expect(shape(roots[0])).toEqual({ A: [{ B: [{ C: [] }] }] });
  });
});

describe('Parseo de los campos nuevos', () => {
  const H = 'a'.repeat(64);
  it('anchorProof solo entera y con ANCHORED; evidenceRef solo sha256 en DELIVERED; un anchorStatus desconocido no se muestra', () => {
    const proof = { merkleRoot: 'b'.repeat(64), leafIndex: 0, path: [], transactionHash: '0x1', network: 'sepolia', anchoredAt: '2026-10-08T10:00:00Z' };
    expect(parseTransition({ eventType: 'ASSET_REGISTERED', anchorStatus: 'ANCHORED', eventHash: H, anchorProof: proof }).anchorProof).toEqual(proof);
    expect(parseTransition({ eventType: 'ASSET_REGISTERED', anchorStatus: 'PENDING', eventHash: H, anchorProof: proof }).anchorProof).toBeUndefined();
    expect(parseTransition({ eventType: 'ASSET_REGISTERED', anchorStatus: 'ANCHORED', eventHash: H, anchorProof: { ...proof, path: [{ side: 'UP', hash: H }] } }).anchorProof).toBeUndefined();
    expect(parseTransition({ eventType: 'ASSET_REGISTERED', anchorStatus: 'RARO' }).anchorStatus).toBeUndefined();
    expect(parseTransition({ eventType: 'ASSET_REGISTERED', eventHash: 'XYZ' }).eventHash).toBeUndefined();
    const ev = 'sha256:' + 'c'.repeat(64);
    expect(parseTransition({ eventType: 'ASSET_DELIVERED', evidenceRegistered: true, evidenceRef: ev })).toMatchObject({ evidenceRegistered: true, evidenceRef: ev });
    expect(parseTransition({ eventType: 'ASSET_DELIVERED', evidenceRegistered: true, evidenceRef: 'Juan Pérez, foto.jpg' }).evidenceRef).toBeUndefined();
    expect(parseTransition({ eventType: 'ASSET_RECEIVED', evidenceRegistered: true, evidenceRef: ev })).toMatchObject({ evidenceRegistered: undefined, evidenceRef: undefined });
  });
  it('firstClearedAt, lastClearedAt y parentAssetRef', () => {
    const d = parseTracking({ status: 'EN_PROCESO', financialSnapshot: { firstClearedAt: '2026-10-02T10:14:00Z', lastClearedAt: '2026-10-03T10:00:00Z' },
      logistics: [{ assetRef: 'A' }, { assetRef: 'B', parentAssetRef: 'A' }] })!;
    expect(d.financialSnapshot).toMatchObject({ firstClearedAt: '2026-10-02T10:14:00Z', lastClearedAt: '2026-10-03T10:00:00Z' });
    expect(d.logistics[1].parentAssetRef).toBe('A');
  });
});

describe('Serpiente: geometría', () => {
  it('estaciones alternas; tramos iguales: la estación i está en i/(n-1) del camino', () => {
    const g = snakeGeometry(3);
    expect(g.points.map((p) => p.x)).toEqual([40, 260, 40]);
    expect(stationDistance(0, 3)).toBe(0);
    expect(stationDistance(1, 3)).toBe(50);
    expect(stationDistance(2, 3)).toBe(100);
    expect(stationDistance(0, 1)).toBe(0);
  });
});

// --- Pantalla ---
const leaf = V.find((v) => v.description === '5 hojas, indice 2')!;
const PROOF = { merkleRoot: leaf.root, leafIndex: 2, path: leaf.path, transactionHash: '0x' + 'cd'.repeat(32), network: 'sepolia', anchoredAt: '2026-10-08T10:00:00Z' };
const BASE = {
  financialSnapshot: { currency: 'COP', originalAmount: 30000000, clearedAmount: 30000000, firstClearedAt: '2026-10-02T10:14:00Z', lastClearedAt: '2026-10-03T09:00:00Z' },
  status: 'EN_PROCESO',
  logistics: [
    { assetRef: 'LOTE-A', lifecycleStatus: 'DELIVERED', assetType: 'Kits de alimentos', unitOfMeasure: 'kit', quantity: '120', custodianCategory: 'LOCAL_ALLY' },
    { assetRef: 'LOTE-B', lifecycleStatus: 'DISPATCHED', assetType: 'Kits escolares', unitOfMeasure: 'kit', quantity: '80', custodianCategory: 'LOGISTICS_PARTNER' },
    { assetRef: 'SUB-B1', parentAssetRef: 'LOTE-B', lifecycleStatus: 'RECEIVED', assetType: 'Kits escolares', unitOfMeasure: 'kit', quantity: '40', custodianCategory: 'LOCAL_ALLY' },
    { assetRef: 'HUERFANO', parentAssetRef: 'OTRA-DONACION', lifecycleStatus: 'REGISTERED', assetType: 'Abrigo', unitOfMeasure: 'kit', quantity: '5', custodianCategory: 'LOCAL_ALLY' },
  ],
};
const at = (i: number) => `2026-10-0${i + 3}T10:00:00Z`;
const HIST: Record<string, Transition[]> = {
  'LOTE-A': [
    { eventType: 'ASSET_REGISTERED', timestamp: at(0), custodianCategory: 'REGIONAL_WAREHOUSE', locationZone: 'Montería', anchorStatus: 'ANCHORED', eventHash: leaf.leaves[2], anchorProof: PROOF },
    { eventType: 'ASSET_DISPATCHED', timestamp: at(1), custodianCategory: 'LOGISTICS_PARTNER', anchorStatus: 'ANCHORED', eventHash: 'e'.repeat(64) },
    { eventType: 'ASSET_DELIVERED', timestamp: at(2), custodianCategory: 'LOCAL_ALLY', locationZone: 'Lorica', anchorStatus: 'UNDER_REVIEW', eventHash: 'f'.repeat(64), evidenceRegistered: true, evidenceRef: 'sha256:' + '1'.repeat(60) + 'abcd' },
  ],
  'LOTE-B': [
    { eventType: 'ASSET_REGISTERED', timestamp: at(0), custodianCategory: 'REGIONAL_WAREHOUSE', anchorStatus: 'IN_BATCH', eventHash: 'd'.repeat(64) },
    { eventType: 'ASSET_DISPATCHED', timestamp: at(1), custodianCategory: 'LOGISTICS_PARTNER', anchorStatus: 'PENDING' },
  ],
  'SUB-B1': [{ eventType: 'ASSET_RECEIVED', timestamp: at(2), custodianCategory: 'LOCAL_ALLY', anchorStatus: 'PENDING' }],
  HUERFANO: [{ eventType: 'ASSET_DELIVERED', timestamp: at(0), custodianCategory: 'LOCAL_ALLY', evidenceRegistered: false }],
};

async function openScreen(hist: Record<string, Transition[]> = HIST, over: Record<string, unknown> = {}) {
  render(<TrackingScreen clients={{
    tracking: async () => ({ kind: 'ok', data: parseTracking({ ...BASE, ...over })! }),
    narrative: async () => ({ kind: 'ok', data: { status: 'PENDING' } }),
    history: async (_c, ref) => ({ kind: 'ok', data: hist[ref] ?? [] }),
    integrity: async () => ({ kind: 'ok', data: { batches: [], unanchoredEvents: 0 } }),
  }} />);
  fireEvent.change(screen.getByLabelText('Código de seguimiento'), { target: { value: 'TRK.prueba-8841' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ver seguimiento' }));
  await screen.findAllByTestId('tracking-step');
  await waitFor(() => expect(screen.getAllByTestId('tracking-step')).toHaveLength(7));
}
const detail = () => screen.getByTestId('step-detail');
/** El botón de un paso en el árbol; `nth` distingue dos lotes con el mismo tipo (padre y sublote). */
const stepButton = (lot: string, name: string, nth = 0) =>
  within(screen.getAllByRole('list', { name: `Recorrido de ${lot}` })[nth]).getByRole('button', { name: new RegExp(name) });

beforeEach(() => session._resetForTest());

describe('Línea de tiempo (F-A5 + F-C2)', () => {
  it('raíz "Donada" con el monto y la fecha del pago; en el detalle, también la última liquidación si es distinta', async () => {
    await openScreen();
    const root = screen.getByTestId('tree-root');
    expect(root).toHaveTextContent('Donada');
    expect(root).toHaveTextContent('300.000 COP');
    expect(within(root).getByTestId('root-date').querySelector('time')).toHaveAttribute('dateTime', '2026-10-02T10:14:00Z');
    fireEvent.click(root);
    expect(within(detail()).getByTestId('detail-first-cleared').querySelector('time')).toHaveAttribute('dateTime', '2026-10-02T10:14:00Z');
    expect(within(detail()).getByTestId('detail-last-cleared').querySelector('time')).toHaveAttribute('dateTime', '2026-10-03T09:00:00Z');
  });

  it('con un solo FUNDS_CLEARED (fechas iguales) no se repite la última; sin pago confirmado no hay fecha', async () => {
    await openScreen(HIST, { financialSnapshot: { ...BASE.financialSnapshot, lastClearedAt: BASE.financialSnapshot.firstClearedAt } });
    fireEvent.click(screen.getByTestId('tree-root'));
    expect(within(detail()).queryByTestId('detail-last-cleared')).toBeNull();
  });

  it('árbol: el sublote va dentro de su padre; un padre que no está en la respuesta hace de raíz', async () => {
    await openScreen();
    const lanes = screen.getAllByTestId('asset-lane');
    const parentB = lanes.find((l) => l.getAttribute('data-depth') === '0' && within(l).queryAllByRole('heading', { name: 'Kits escolares', level: 3 }).length > 0)!;
    const sub = within(parentB).getAllByTestId('asset-lane');
    expect(sub).toHaveLength(1);
    expect(sub[0]).toHaveAttribute('data-depth', '1');
    expect(sub[0]).toHaveTextContent('Sublote');
    const orphan = lanes.find((l) => within(l).queryByRole('heading', { name: 'Abrigo' }))!;
    expect(orphan).toHaveAttribute('data-depth', '0');
  });

  it('el paso seleccionado cambia el detalle (aria-live polite), con clic y con el teclado', async () => {
    await openScreen();
    expect(detail()).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(stepButton('Kits de alimentos', 'Registrado'));
    expect(detail()).toHaveTextContent('Registrado');
    expect(detail()).toHaveTextContent('ASSET_REGISTERED');
    expect(detail()).toHaveTextContent('Montería');
    expect(detail()).not.toHaveTextContent('ASSET_DELIVERED');
    const dispatched = stepButton('Kits de alimentos', 'Despachado');
    dispatched.focus();
    fireEvent.keyDown(dispatched, { key: 'Enter' });
    fireEvent.click(dispatched); // un <button> nativo: Enter y Espacio lo activan
    expect(detail()).toHaveTextContent('ASSET_DISPATCHED');
    expect(detail()).toHaveTextContent('Sin zona pública');
    expect(dispatched).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Huella criptográfica" recortada; "Copiar" copia la completa', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => { writes.push(t); } } });
    await openScreen();
    fireEvent.click(stepButton('Kits de alimentos', 'Registrado'));
    expect(within(detail()).getAllByTestId('hash-short')[0]).toHaveTextContent(shortHash(leaf.leaves[2]));
    expect(detail().textContent).not.toContain(leaf.leaves[2]);
    fireEvent.click(within(detail()).getByRole('button', { name: 'Copiar huella' }));
    await waitFor(() => expect(writes).toEqual([leaf.leaves[2]]));
  });

  it('con anchorProof: "Comprobar en mi navegador" → "Coincide", con enlace al explorador de Sepolia y el texto de E1.4', async () => {
    await openScreen();
    fireEvent.click(stepButton('Kits de alimentos', 'Registrado'));
    expect(within(detail()).getByTestId('anchor-pill')).toHaveTextContent('Anclado en blockchain');
    fireEvent.click(within(detail()).getByRole('button', { name: 'Comprobar en mi navegador' }));
    expect(await within(detail()).findByTestId('verify-result')).toHaveAttribute('data-result', 'match');
    expect(detail()).toHaveTextContent('Coincide');
    expect(detail()).not.toHaveTextContent('No coincide');
    expect(detail()).toHaveTextContent('No comprueba que la huella corresponda al contenido del evento');
    expect(within(detail()).getByTestId('tx-link')).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${PROOF.transactionHash}`);
  });

  it('una prueba alterada da "No coincide" (rojo, con icono), nunca "Coincide"', async () => {
    const bad = { ...HIST, 'LOTE-A': [{ ...HIST['LOTE-A'][0], anchorProof: { ...PROOF, path: PROOF.path.map((p, i) => (i === 0 ? { ...p, hash: flip(p.hash) } : p)) } }, ...HIST['LOTE-A'].slice(1)] };
    await openScreen(bad);
    fireEvent.click(stepButton('Kits de alimentos', 'Registrado'));
    fireEvent.click(within(detail()).getByRole('button', { name: 'Comprobar en mi navegador' }));
    const r = await within(detail()).findByTestId('verify-result');
    expect(r).toHaveAttribute('data-result', 'mismatch');
    expect(within(r).getByTestId('status-notice-rejected')).toHaveTextContent('No coincide');
    expect(within(r).getByTestId('status-notice-rejected').querySelector('svg')).not.toBeNull();
    expect(r).not.toHaveTextContent(/^Coincide/);
  });

  it('otra red: sin enlace al explorador', async () => {
    const other = { ...HIST, 'LOTE-A': [{ ...HIST['LOTE-A'][0], anchorProof: { ...PROOF, network: 'ganache-local' } }, ...HIST['LOTE-A'].slice(1)] };
    await openScreen(other);
    fireEvent.click(stepButton('Kits de alimentos', 'Registrado'));
    expect(within(detail()).getByTestId('anchor-verify')).toBeInTheDocument();
    expect(within(detail()).queryByTestId('tx-link')).toBeNull();
  });

  it('ANCHORED sin prueba: se explica que es un lote antiguo y no hay botón (negativa)', async () => {
    await openScreen();
    fireEvent.click(stepButton('Kits de alimentos', 'Despachado'));
    expect(within(detail()).getByTestId('anchor-legacy')).toHaveTextContent('lote antiguo');
    expect(within(detail()).queryByRole('button', { name: 'Comprobar en mi navegador' })).toBeNull();
  });

  it('sin anchorProof ni ANCHORED: sin botón ni texto de lote antiguo (negativa)', async () => {
    await openScreen();
    fireEvent.click(stepButton('Kits escolares', 'Registrado'));
    expect(within(detail()).getByTestId('anchor-pill')).toHaveTextContent('En el próximo anclaje');
    expect(within(detail()).queryByRole('button', { name: 'Comprobar en mi navegador' })).toBeNull();
    expect(within(detail()).queryByTestId('anchor-legacy')).toBeNull();
  });

  it('UNDER_REVIEW: amarillo con icono en el paso y en el detalle, nunca como anclado', async () => {
    await openScreen();
    const delivered = stepButton('Kits de alimentos', 'Entregado');
    const pill = within(delivered).getByTestId('anchor-pill');
    expect(pill).toHaveAttribute('data-status', 'UNDER_REVIEW');
    expect(pill).toHaveTextContent('En revisión');
    expect(pill.querySelector('svg')).not.toBeNull();
    fireEvent.click(delivered);
    expect(within(detail()).getByTestId('anchor-pill')).toHaveTextContent('En revisión');
    expect(detail()).not.toHaveTextContent('Anclado en blockchain');
  });

  it('foto de la entrega: "Con foto de entrega" y su huella recortada; "Sin foto" si no la tiene; nunca la imagen', async () => {
    await openScreen();
    fireEvent.click(stepButton('Kits de alimentos', 'Entregado'));
    expect(within(detail()).getByTestId('detail-evidence')).toHaveTextContent('Con foto de entrega');
    expect(within(detail()).getByTestId('detail-evidence')).toHaveTextContent('1111…abcd');
    fireEvent.click(stepButton('Abrigo', 'Entregado'));
    expect(within(detail()).getByTestId('detail-evidence')).toHaveTextContent('Sin foto');
    expect(document.querySelector('img')).toBeNull();
  });

  it('serpiente: pestañas por lote; el camión solo conduce si el último evento del lote es ASSET_DISPATCHED', async () => {
    await openScreen();
    const snake = screen.getByTestId('snake');
    const tabs = within(snake).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Kits de alimentos', 'Kits escolares 2', 'Kits escolares 3', 'Abrigo']);
    // Lote A termina en "Entregado": parado (negativa del movimiento)
    fireEvent.click(tabs[0]);
    expect(within(snake).getByTestId('snake-truck')).toHaveAttribute('data-driving', 'false');
    expect(within(snake).getAllByTestId('snake-station').map((s) => s.textContent)).toEqual(
      [expect.stringContaining('Pago confirmado'), expect.stringContaining('Registrado'), expect.stringContaining('Despachado'), expect.stringContaining('Entregado')]);
    // Lote B termina en "Despachado": conduce hasta esa estación
    fireEvent.click(tabs[1]);
    const truck = within(snake).getByTestId('snake-truck');
    expect(truck).toHaveAttribute('data-driving', 'true');
    expect(truck.style.getPropertyValue('--to')).toBe('100%');
    expect(truck.style.getPropertyValue('--from')).toBe('50%');
    // Elegir una estación selecciona el paso
    fireEvent.click(within(snake).getAllByTestId('snake-station')[1]);
    expect(detail()).toHaveTextContent('ASSET_REGISTERED');
  });

  it('elegir un paso de otro lote en el árbol cambia la pestaña de la serpiente', async () => {
    await openScreen();
    fireEvent.click(stepButton('Abrigo', 'Entregado'));
    expect(within(screen.getByTestId('snake')).getByRole('tab', { name: 'Abrigo' })).toHaveAttribute('aria-selected', 'true');
  });

  it('el camión del árbol solo en el paso ASSET_DISPATCHED cuando es el último', async () => {
    await openScreen();
    const trucks = screen.getAllByTestId('tracking-truck');
    expect(trucks).toHaveLength(1);
    expect(trucks[0].closest('[data-testid="tracking-step"]')).toHaveTextContent('Despachado');
    expect(trucks[0].closest('[data-testid="asset-lane"]')).toHaveTextContent('Kits escolares');
  });
});
