'use client';
// Ref: Documentos/prompts-agentes-estilo-v2.md VS-1; Documentos/sistema-visual-paxfide-web-enmienda-1.md §7.2; Documentos/plan-vs1-movimiento.md §2–§5.
import React from 'react';
import s from './Loaders.module.css';

export type MerkleTreeLoaderProps = {
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-label'?: string;
};

/**
 * 09 Árbol de Merkle: animación escalonada de verificación criptográfica.
 * Hojas azules (nivel base), ramas intermedias y nodo raíz dorado, enlazados por aristas.
 */
export function MerkleTreeLoader({
  className,
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel = 'Verificando integridad',
}: MerkleTreeLoaderProps) {
  const isHidden = ariaHidden === true || ariaHidden === 'true';

  return (
    <div
      className={[s.merkleWrapper, className ?? ''].join(' ')}
      role={isHidden ? undefined : 'img'}
      aria-label={isHidden ? undefined : ariaLabel}
      aria-hidden={isHidden ? true : undefined}
    >
      <svg
        className={s.merkleSvg}
        viewBox="0 0 150 110"
        aria-hidden="true"
        focusable="false"
      >
        {/* Aristas conectoras */}
        <path
          className={s.merkleEdge}
          d="M24 86 L48 56 M58 86 L48 56 M92 86 L102 56 M126 86 L102 56 M48 56 L75 24 M102 56 L75 24"
        />

        {/* 4 Nodos hoja (nivel 0) */}
        <rect className={[s.merkleNode, s.merkleLeaf, s.merkleLeaf1].join(' ')} x="14" y="78" width="20" height="20" rx="4" />
        <rect className={[s.merkleNode, s.merkleLeaf, s.merkleLeaf2].join(' ')} x="48" y="78" width="20" height="20" rx="4" />
        <rect className={[s.merkleNode, s.merkleLeaf, s.merkleLeaf3].join(' ')} x="82" y="78" width="20" height="20" rx="4" />
        <rect className={[s.merkleNode, s.merkleLeaf, s.merkleLeaf4].join(' ')} x="116" y="78" width="20" height="20" rx="4" />

        {/* 2 Nodos intermedios (nivel 1) */}
        <rect className={[s.merkleNode, s.merkleBranch].join(' ')} x="37" y="45" width="22" height="22" rx="5" />
        <rect className={[s.merkleNode, s.merkleBranch].join(' ')} x="91" y="45" width="22" height="22" rx="5" />

        {/* 1 Nodo raíz dorado (nivel 2) */}
        <rect className={[s.merkleNode, s.merkleRoot].join(' ')} x="61" y="10" width="28" height="28" rx="7" />
      </svg>
    </div>
  );
}
