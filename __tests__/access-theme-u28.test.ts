// Ref: plan-fase7-puesta-al-dia.md Anexo 4, U-28: regla nueva del sistema visual. El tema lo decide un único contenedor;
// ninguna hoja de componente lo deduce de cualquier antepasado con `:global([data-theme=…]) .x`.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../src');
const cssFiles = (dir: string): string[] => fs.readdirSync(dir).flatMap((f) => {
  const full = path.join(dir, f);
  return fs.statSync(full).isDirectory() ? cssFiles(full) : full.endsWith('.module.css') ? [full] : [];
});

describe('U-28 · el tema sale del contenedor más cercano', () => {
  it('ninguna hoja de componente usa :global([data-theme=…]) .x', () => {
    for (const f of cssFiles(SRC)) {
      const code = fs.readFileSync(f, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code, path.relative(SRC, f)).not.toMatch(/:global\(\s*\[data-theme/);
    }
  });

  it('el contenedor del acceso define cada variable --acc-* en claro y en oscuro', () => {
    const css = fs.readFileSync(path.join(SRC, 'components/access/AccessLayout.module.css'), 'utf-8');
    const block = (sel: string) => {
      const i = css.lastIndexOf(`${sel} {`);
      return [...css.slice(i, css.indexOf('}', i)).matchAll(/(--acc-[a-z0-9-]+):/g)].map((m) => m[1]).sort();
    };
    const light = block('.root');
    const dark = block('.root[data-theme="dark"]');
    expect(light.length).toBeGreaterThan(10);
    expect(dark).toEqual(light);
    // Y las hojas solo usan variables que el contenedor define
    for (const f of ['screens/access.module.css', 'screens/legal.module.css']) {
      const used = [...fs.readFileSync(path.join(SRC, f), 'utf-8').matchAll(/var\((--acc-[a-z0-9-]+)/g)].map((m) => m[1]);
      for (const v of used) expect(light, `${f}: ${v}`).toContain(v);
    }
  });
});
