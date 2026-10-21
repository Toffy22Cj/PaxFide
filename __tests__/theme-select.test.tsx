// Ref: prompts-agentes-estilo-v2.md VS-0 (selector de tema mínimo); decisiones-delegadas-web-fase7.md DF7-10.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeSelect } from '../src/components/theme/ThemeSelect';
import { THEME_STORAGE_KEY } from '../src/lib/theme/theme';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
  try { window.localStorage.clear(); } catch { /* jsdom */ }
});

describe('ThemeSelect', () => {
  it('ofrece sistema, claro y oscuro con etiqueta accesible', () => {
    render(<ThemeSelect />);
    const select = screen.getByLabelText('Tema') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['Como el sistema', 'Claro', 'Oscuro']);
    expect(select.value).toBe('system');
  });

  it('elegir oscuro pone data-theme y guarda la preferencia; sistema la quita', () => {
    render(<ThemeSelect />);
    const select = screen.getByLabelText('Tema');
    fireEvent.change(select, { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.change(select, { target: { value: 'system' } });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('muestra la preferencia guardada al montar', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeSelect />);
    expect((screen.getByLabelText('Tema') as HTMLSelectElement).value).toBe('light');
  });

  it('con un localStorage que lanza, el tema cambia igual y no rompe', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    render(<ThemeSelect />);
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
