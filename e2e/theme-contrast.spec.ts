// Ref: plan-fase7-pantallas.md C-1 (búsqueda de pares fuera de tabla en oscuro, contraste < 4,5 falla; sin axe, D8) y
// plan-fase7-fidelidad.md F-A0. El recorrido es el mismo que el de las capturas (e2e/support/screens.ts).
import { test, expect } from '@playwright/test';
import { contrastFailures } from './support/contrast';
import { TOURS, login, seedDonation } from './support/screens';

for (const scheme of ['dark', 'light'] as const) {
  for (const tour of TOURS) {
    test(`contraste ≥ 4,5 en ${scheme === 'dark' ? 'oscuro' : 'claro'}: pantallas ${tour.account === 'none' ? 'sin sesión' : `de ${tour.account}`}`, async ({ page, request }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      if (tour.account === 'donante') await seedDonation(request);
      if (tour.account !== 'none') await login(page, tour.account);
      const report: string[] = [];
      for (const screen of tour.screens) {
        await test.step(screen.name, () => screen.go(page));
        // El tema efectivo es el del sistema: nada lo fuerza (DF7-17 retirada)
        expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBeNull();
        for (const f of await contrastFailures(page)) report.push(`${screen.name}: "${f.text}" ${f.color} sobre ${f.background} = ${f.ratio} (${f.selector})`);
      }
      expect(report, report.join('\n')).toEqual([]);
    });
  }
}

test('el escáner detecta un par fuera de tabla (dark-border-control como texto sobre dark-surface: 3,80 en la enmienda §4.3)', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    const p = document.createElement('p');
    p.textContent = 'Texto de control';
    p.setAttribute('data-testid', 'control-contraste');
    p.style.cssText = 'color: var(--dark-border-control); background: var(--dark-surface); padding: 8px;';
    document.querySelector('main')!.appendChild(p);
  });
  const failures = await contrastFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0].text).toBe('Texto de control');
  expect(failures[0].ratio).toBeCloseTo(3.80, 2);
});
