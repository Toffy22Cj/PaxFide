import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/plan-vs1-movimiento.md §1, §2, §7, §9.
import {
  BrandDots,
  Skeleton,
  SkeletonCard,
  SkeletonList,
  TopProgressBar,
  TruckLoader,
  MerkleTreeLoader,
  ChainCubesLoader,
} from '../src/components/loaders';
import { Button } from '../src/components/ui/Button';

describe('Componentes de carga (VS-1)', () => {
  describe('01 · ChainCubesLoader', () => {
    it('renderiza como role="status" con etiqueta accesible por defecto', () => {
      render(<ChainCubesLoader />);
      const loader = screen.getByRole('status', { name: 'Cargando' });
      expect(loader).toBeInTheDocument();
      expect(loader.querySelectorAll('svg')).toHaveLength(3);
    });

    it('respeta aria-hidden="true" omitiendo role y aria-label', () => {
      const { container } = render(<ChainCubesLoader aria-hidden="true" />);
      expect(screen.queryByRole('status')).toBeNull();
      const el = container.firstElementChild;
      expect(el).toHaveAttribute('aria-hidden', 'true');
      expect(el).not.toHaveAttribute('role');
      expect(el).not.toHaveAttribute('aria-label');
    });
  });

  describe('03 · TruckLoader', () => {
    it('renderiza como role="img" con etiqueta accesible por defecto', () => {
      render(<TruckLoader />);
      const loader = screen.getByRole('img', { name: 'En camino' });
      expect(loader).toBeInTheDocument();
      expect(loader.querySelector('svg')).toBeInTheDocument();
    });

    it('soporta aria-hidden="true" si se anida dentro de un contenedor accesible', () => {
      const { container } = render(<TruckLoader aria-hidden="true" />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('06 · BrandDots', () => {
    it('renderiza 3 puntos con role="status" cuando está aislado', () => {
      const { container } = render(<BrandDots aria-label="Guardando datos" />);
      const status = screen.getByRole('status', { name: 'Guardando datos' });
      expect(status).toBeInTheDocument();
      expect(container.querySelectorAll('i')).toHaveLength(3);
    });

    it('al recibir aria-hidden="true" no compite con el anuncio del contenedor', () => {
      const { container } = render(<BrandDots aria-hidden="true" />);
      expect(screen.queryByRole('status')).toBeNull();
      expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
      expect(container.firstElementChild).not.toHaveAttribute('role');
    });
  });

  describe('07 · Skeleton', () => {
    it('Skeleton base expone role="status" y aria-label configurable', () => {
      render(<Skeleton width="200px" height="20px" aria-label="Cargando título" />);
      const skeleton = screen.getByRole('status', { name: 'Cargando título' });
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveStyle({ width: '200px', height: '20px' });
    });

    it('SkeletonCard anuncia la carga y mantiene los esqueletos hijos con aria-hidden', () => {
      const { container } = render(<SkeletonCard />);
      const card = screen.getByRole('status', { name: 'Cargando tarjeta' });
      expect(card).toBeInTheDocument();
      const children = container.querySelectorAll('[aria-hidden="true"]');
      expect(children.length).toBeGreaterThanOrEqual(4);
    });

    it('SkeletonList genera el número solicitado de filas', () => {
      render(<SkeletonList count={4} />);
      const list = screen.getByRole('status', { name: 'Cargando lista' });
      expect(list).toBeInTheDocument();
      expect(list.children).toHaveLength(4);
    });
  });

  describe('08 · TopProgressBar', () => {
    it('renderiza como role="progressbar" indeterminado cuando está activo', () => {
      render(<TopProgressBar />);
      const bar = screen.getByRole('progressbar', { name: 'Cargando página' });
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });

    it('no renderiza nada cuando active es false', () => {
      const { container } = render(<TopProgressBar active={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('09 · MerkleTreeLoader', () => {
    it('renderiza como role="img" con las 4 hojas, 2 ramas y 1 raíz', () => {
      const { container } = render(<MerkleTreeLoader />);
      const loader = screen.getByRole('img', { name: 'Verificando integridad' });
      expect(loader).toBeInTheDocument();
      // 4 rectángulos de hojas + 2 ramas + 1 raíz = 7 rectángulos
      expect(container.querySelectorAll('rect')).toHaveLength(7);
      expect(container.querySelector('path')).toBeInTheDocument();
    });

    it('soporta aria-hidden="true" para su uso en tarjetas o cabeceras', () => {
      const { container } = render(<MerkleTreeLoader aria-hidden="true" />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Integración de BrandDots en Button.tsx', () => {
    it('con sending={false}: no incluye BrandDots, no está deshabilitado y no tiene aria-busy', () => {
      const { container } = render(<Button sending={false}>Confirmar</Button>);
      const btn = screen.getByRole('button', { name: 'Confirmar' });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
      expect(btn).not.toHaveAttribute('aria-busy');
      expect(container.querySelector('i')).toBeNull();
    });

    it('con sending={true}: preserva el texto visible, se deshabilita, anuncia aria-busy y monta BrandDots con aria-hidden', () => {
      const { container } = render(<Button sending={true}>Guardar cambios</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
      // El texto visible 'Guardar cambios' no desaparece
      expect(btn).toHaveTextContent('Guardar cambios');
      // Los puntos de marca están presentes y tienen aria-hidden="true" para evitar doble anuncio
      const dots = container.querySelector('[aria-hidden="true"]');
      expect(dots).toBeInTheDocument();
      expect(container.querySelectorAll('i')).toHaveLength(3);
    });
  });

  describe('Reducción de movimiento estructural (Loaders.module.css)', () => {
    it('toda clase animada tiene su regla en @media (prefers-reduced-motion: reduce)', () => {
      const cssPath = path.resolve(__dirname, '../src/components/loaders/Loaders.module.css');
      const css = fs.readFileSync(cssPath, 'utf-8');

      // Buscar bloques de @media (prefers-reduced-motion: reduce)
      const mediaMatch = css.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{([\s\S]*?)\}\s*$/);
      expect(mediaMatch, 'Debe existir un bloque @media (prefers-reduced-motion: reduce) en Loaders.module.css').not.toBeNull();

      const mediaBody = mediaMatch![1];
      // Verificar que el bloque reduce contiene animation-play-state: paused
      expect(mediaBody).toMatch(/animation-play-state\s*:\s*paused\s*!important/);

      // Extraer dinámicamente cualquier clase que declare animación fuera del bloque reduce
      const [mainCss] = css.split(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
      const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
      const animatedClasses = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = ruleRegex.exec(mainCss)) !== null) {
        const selector = match[1].trim();
        const body = match[2];
        if (/@keyframes/.test(selector)) continue;
        if (/animation(?:-name)?\s*:/.test(body)) {
          const classes = selector.match(/\.[a-zA-Z0-9_-]+/g) || [];
          for (const cls of classes) {
            animatedClasses.add(cls);
          }
        }
      }

      expect(animatedClasses.size).toBeGreaterThan(0);

      // Verificar que cada clase animada esté explícitamente pausada en mediaBody
      for (const cls of animatedClasses) {
        expect(
          mediaBody,
          `La clase animada ${cls} debe tener su regla dentro de @media (prefers-reduced-motion: reduce)`,
        ).toContain(cls);
      }
    });
  });
});
