'use client';

// Ref: Documentos/plan-fase7-pantallas.md §5 B-2; Documentos/prompts-agentes-estilo-v2.md §3.2.
// Comandos ambiguos en memoria de la sesión (D6): solo durante la sesión que los originó.

export interface AmbiguousCommandItem {
  id: string;
  title: string;
  detail: string;
  createdAt: number;
}

let sessionAmbiguousCommands: AmbiguousCommandItem[] = [];

export function getAmbiguousSessionCommands(): AmbiguousCommandItem[] {
  return [...sessionAmbiguousCommands];
}

export function recordAmbiguousSessionCommand(item: AmbiguousCommandItem): void {
  sessionAmbiguousCommands = [item, ...sessionAmbiguousCommands.filter((c) => c.id !== item.id)];
}

export function clearAmbiguousSessionCommand(id: string): void {
  sessionAmbiguousCommands = sessionAmbiguousCommands.filter((c) => c.id !== id);
}

export function resetAmbiguousSessionCommands(): void {
  sessionAmbiguousCommands = [];
}
