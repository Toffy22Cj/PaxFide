// Ref: prompts-agentes-estilo-v2.md VS-2; respuesta de Carlos al plan de VS-2 (B, C); ADR-046 D5; enmienda §8 (E4).
import { describe, it, expect } from 'vitest';
import { activeEntry, navEntriesFor, positionForWidth, routeFor, type NavIcon } from '../src/lib/nav/navEntries';
import { nextNavPrincipal } from '../src/lib/nav/navPrincipal';
import type { Principal } from '../src/lib/api/identity';

const ALL = new Set(['/home', '/campaigns', '/account/donations', '/tracking', '/panel', '/panel/campaigns', '/panel/assets']);
const allEnabled = (s: string) => ALL.has(s);
const ids = (ctx: Parameters<typeof navEntriesFor>[0], en = allEnabled) => navEntriesFor(ctx, en).map((e) => e.id);

const admin: Principal = { accountId: 'a', organizationId: 'org-1', roles: ['ADMINISTRATOR'] };
const employee: Principal = { accountId: 'e', organizationId: 'org-1', roles: ['EMPLOYEE'] };
const rep: Principal = { accountId: 'r', organizationId: 'org-1', roles: ['REPRESENTATIVE'] };
const donor: Principal = { accountId: 'd', roles: [] };

describe('navEntriesFor — entradas según sesión, rol y superficies', () => {
  it('sin sesión: solo Explorar y Seguimiento', () => {
    expect(ids({ authenticated: false, principal: null })).toEqual(['explorar', 'seguimiento']);
  });

  it('cuenta sin organización: Inicio, Explorar, Donaciones, Seguimiento; nunca "Organización"', () => {
    const r = ids({ authenticated: true, principal: donor });
    expect(r).toEqual(['inicio', 'explorar', 'donaciones', 'seguimiento']);
    expect(r).not.toContain('organizacion');
  });

  it('ADMINISTRATOR: también Organización, Convocatorias y Lotes; los miembros ven Donaciones y Seguimiento (C)', () => {
    expect(ids({ authenticated: true, principal: admin })).toEqual(
      ['inicio', 'explorar', 'donaciones', 'seguimiento', 'organizacion', 'convocatorias', 'lotes']);
  });

  it('EMPLOYEE: Organización y Lotes, sin Convocatorias', () => {
    const r = ids({ authenticated: true, principal: employee });
    expect(r).toEqual(['inicio', 'explorar', 'donaciones', 'seguimiento', 'organizacion', 'lotes']);
    expect(r).not.toContain('convocatorias');
  });

  it('REPRESENTATIVE: Organización, sin Convocatorias ni Lotes', () => {
    const r = ids({ authenticated: true, principal: rep });
    expect(r).toContain('organizacion');
    expect(r).not.toContain('convocatorias');
    expect(r).not.toContain('lotes');
  });

  it('con sesión y /me sin datos (DW-06): solo las entradas que no dependen del rol', () => {
    expect(ids({ authenticated: true, principal: null })).toEqual(['inicio', 'explorar', 'donaciones', 'seguimiento']);
  });

  it('una superficie deshabilitada no aparece (D5), aunque el rol la permita', () => {
    const without = (s: string) => allEnabled(s) && s !== '/panel/assets' && s !== '/home';
    const r = ids({ authenticated: true, principal: admin }, without);
    expect(r).not.toContain('lotes');
    expect(r).not.toContain('inicio');
    expect(ids({ authenticated: true, principal: admin }, () => false)).toEqual([]);
  });

  it('perfil, ajustes y QR nunca aparecen: no tienen ruta aprobada', () => {
    const r = ids({ authenticated: true, principal: admin }, () => true);
    for (const id of ['perfil', 'ajustes', 'qr'] as NavIcon[]) {
      expect(r).not.toContain(id);
      expect(routeFor(id).href).toBeNull();
    }
  });

  it('con la lista de demo de hoy, Inicio no aparece (llega con VS-5)', () => {
    const today = (s: string) => allEnabled(s) && s !== '/home';
    expect(ids({ authenticated: true, principal: admin }, today)).not.toContain('inicio');
  });

  it('etiquetas y rutas de la respuesta B', () => {
    expect(routeFor('organizacion')).toEqual({ label: 'Organización', href: '/panel' });
  });
});

describe('activeEntry', () => {
  const entries = navEntriesFor({ authenticated: true, principal: admin }, allEnabled);
  it('el prefijo más largo gana', () => {
    expect(activeEntry('/panel/campaigns', entries)).toBe('convocatorias');
    expect(activeEntry('/panel/assets', entries)).toBe('lotes');
    expect(activeEntry('/panel/funds', entries)).toBe('organizacion');
    expect(activeEntry('/panel', entries)).toBe('organizacion');
    expect(activeEntry('/campaigns', entries)).toBe('explorar');
  });
  it('por segmentos y sin coincidencias ajenas', () => {
    expect(activeEntry('/panelx', entries)).toBeNull();
    expect(activeEntry('/login', entries)).toBeNull();
    expect(activeEntry('/c/abc', entries)).toBeNull();
  });
});

describe('positionForWidth (enmienda §8, E4)', () => {
  it('767 → bottom; 768 → side', () => {
    expect(positionForWidth(390)).toBe('bottom');
    expect(positionForWidth(767)).toBe('bottom');
    expect(positionForWidth(768)).toBe('side');
    expect(positionForWidth(1280)).toBe('side');
  });
});

describe('nextNavPrincipal (GET /me en cada ruta)', () => {
  it('ok sustituye; cualquier fallo conserva lo último conocido', () => {
    expect(nextNavPrincipal(null, { kind: 'ok', principal: admin })).toEqual(admin);
    expect(nextNavPrincipal(admin, { kind: 'ok', principal: donor })).toEqual(donor);
    for (const kind of ['error', 'unavailable', 'unauthorized'] as const) {
      expect(nextNavPrincipal(admin, { kind })).toEqual(admin);
      expect(nextNavPrincipal(null, { kind })).toBeNull();
    }
  });
});
