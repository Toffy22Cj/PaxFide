import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sin `globals`, Testing Library no limpia el DOM entre tests por sí sola
afterEach(() => {
  cleanup();
});
