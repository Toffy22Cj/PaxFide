// Ref: referencia-api-v1.md §8, nota del 2026-10-25 (ficha R-6, Bloque C; G-4: `parentAssetRef?`);
// plan-fase7-puesta-al-dia.md P-2 (árbol de sublotes; un padre ausente hace de raíz).

export interface TreeNode<T> {
  item: T;
  children: TreeNode<T>[];
}

/**
 * El árbol de lotes. Un `parentAssetRef` que no está en la lista (o que apunta al propio lote, o que cerraría un
 * ciclo) se trata como raíz: nunca se inventa un padre. Conserva el orden de llegada.
 */
export function buildAssetTree<T extends { assetRef: string; parentAssetRef?: string }>(items: T[]): TreeNode<T>[] {
  const byRef = new Map(items.map((i) => [i.assetRef, i]));
  const parentOf = (i: T): T | undefined => {
    if (!i.parentAssetRef || i.parentAssetRef === i.assetRef) return undefined;
    const p = byRef.get(i.parentAssetRef);
    if (!p) return undefined;
    // Un ciclo (no debería llegar): el lote que lo cerraría es raíz
    const seen = new Set([i.assetRef]);
    for (let cur: T | undefined = p; cur; cur = cur.parentAssetRef ? byRef.get(cur.parentAssetRef) : undefined) {
      if (seen.has(cur.assetRef)) return undefined;
      seen.add(cur.assetRef);
    }
    return p;
  };
  const nodes = new Map(items.map((i) => [i.assetRef, { item: i, children: [] as TreeNode<T>[] }]));
  const roots: TreeNode<T>[] = [];
  for (const i of items) {
    const p = parentOf(i);
    if (p) nodes.get(p.assetRef)!.children.push(nodes.get(i.assetRef)!);
    else roots.push(nodes.get(i.assetRef)!);
  }
  return roots;
}
