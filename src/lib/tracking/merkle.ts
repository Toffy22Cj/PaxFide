// Ref: referencia-api-v1.md §8, nota del 2026-10-25 (ficha R-6, Bloque C; G-3 y Enmienda 1, E1.3 y E1.4);
// plan-fase7-puesta-al-dia.md P-2 ("Comprobar en mi navegador"). Sin dependencias: `crypto.subtle.digest`.

export type ProofSide = 'LEFT' | 'RIGHT';

export interface AnchorProof {
  merkleRoot: string;
  leafIndex: number;
  path: { side: ProofSide; hash: string }[];
  transactionHash: string;
  network: string;
  anchoredAt: string;
}

const HEX64 = /^[0-9a-f]{64}$/;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * E1.3: `nodo = eventHash`; por cada paso, `LEFT → sha256_hex(hash + nodo)` y `RIGHT → sha256_hex(nodo + hash)` (se
 * concatenan los textos hexadecimales, no los bytes); vale si al final `nodo == merkleRoot`. Un dato mal formado no
 * coincide nunca.
 */
export async function verifyAnchorProof(eventHash: string, proof: Pick<AnchorProof, 'merkleRoot' | 'path'>): Promise<boolean> {
  if (!HEX64.test(eventHash) || !HEX64.test(proof.merkleRoot)) return false;
  let node = eventHash;
  for (const step of proof.path) {
    if (!HEX64.test(step.hash)) return false;
    switch (step.side) {
      case 'LEFT': node = await sha256Hex(step.hash + node); break;
      case 'RIGHT': node = await sha256Hex(node + step.hash); break;
      default: {
        const unreachable: never = step.side;
        throw new Error(`Lado desconocido en la prueba: ${String(unreachable)}`);
      }
    }
  }
  return node === proof.merkleRoot;
}

/**
 * Exploradores conocidos (tabla cerrada, P-2). Otra red, incluida la local de la demo, no lleva enlace: nunca se
 * construye una URL para una red que no esté aquí.
 */
const EXPLORERS: Record<string, string> = {
  sepolia: 'https://sepolia.etherscan.io/tx/',
  amoy: 'https://amoy.polygonscan.com/tx/',
};
const TX = /^0x[0-9a-fA-F]{64}$/;

export function explorerUrl(network: string | undefined, transactionHash: string | undefined): string | null {
  if (!network || !transactionHash || !TX.test(transactionHash)) return null;
  const base = Object.prototype.hasOwnProperty.call(EXPLORERS, network) ? EXPLORERS[network] : undefined;
  return base ? base + transactionHash : null;
}

export function explorerName(network: string): string | null {
  return network === 'sepolia' ? 'Etherscan (Sepolia)' : network === 'amoy' ? 'Polygonscan (Amoy)' : null;
}

/** Un hash recortado para mostrar: los 4 primeros y los 4 últimos (como el boceto, "5c22…9f14"). */
export function shortHash(hash: string): string {
  const h = hash.startsWith('sha256:') ? hash.slice(7) : hash;
  return h.length <= 12 ? h : `${h.slice(0, 4)}…${h.slice(-4)}`;
}
