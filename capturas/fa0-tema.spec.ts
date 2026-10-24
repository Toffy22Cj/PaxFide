// Ref: plan-fase7-pantallas.md C-1 (capturas en claro y oscuro a 390 y 1280 px de todas las pantallas) y
// plan-fase7-fidelidad.md F-A0. Mismo recorrido que la prueba de contraste (e2e/support/screens.ts).
import { test } from '@playwright/test';
import path from 'path';
import { TOURS, login, seedDonation } from '../e2e/support/screens';

const OUT = path.join(__dirname, '..', 'Documentos', 'evidencia-web', 'capturas');

for (const width of [390, 1280]) {
  for (const [scheme, label] of [['light', 'claro'], ['dark', 'oscuro']] as const) {
    for (const tour of TOURS) {
      test(`fa0 ${tour.account} ${label} ${width}`, async ({ page, request }) => {
        if (test.info().project.name !== '1280') return; // una sola pasada: el ancho lo fija el test
        test.setTimeout(180_000);
        await page.setViewportSize({ width, height: 860 });
        await page.emulateMedia({ colorScheme: scheme });
        if (tour.account === 'donante') await seedDonation(request);
        if (tour.account !== 'none') await login(page, tour.account);
        for (const screen of tour.screens) {
          await screen.go(page);
          await page.waitForTimeout(900); // la ciudad y el mundo se mueven: unos fotogramas antes de capturar
          await page.screenshot({ path: path.join(OUT, `fa0-${screen.name}__${label}__${width}.png`), fullPage: true });
        }
      });
    }
  }
}
