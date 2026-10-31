import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // U-27 (plan-fase7-puesta-al-dia.md Anexo 4): el build sin perfil ya activa la lista única; los tests unitarios
    // siguen partiendo de la lista vacía (perfil `none`, como antes) y cada uno declara las superficies que usa
    env: { NEXT_PUBLIC_SURFACE_PROFILE: 'none' },
    exclude: ['e2e/**', 'capturas/**', 'ensayo/**', 'node_modules/**', 'Documentos/**'],
  },
})
