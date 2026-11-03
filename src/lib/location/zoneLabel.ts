// Ref: plan-fase7-puesta-al-dia.md Anexo 7, U-47; referencia-api-v1.md, nota del 2026-11-02 (ADR-029 Enmienda 2): la
// zona sellada llega como "MUNICIPIO, DEPARTAMENTO" en mayúsculas, tal cual el catálogo DIVIPOLA. La web solo cambia su
// PRESENTACIÓN: mayúsculas iniciales en español, con los conectores en minúscula salvo al principio de cada parte y las
// siglas con punto ("D.C.") tal cual. Es pura: no cambia el dato ni lo deduce de otro.

const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
/** Una sigla con puntos: "D.C.", "S.A.". */
const ABBREVIATION = /^(\p{L}\.)+$/u;

function word(w: string, first: boolean): string {
  if (!w) return w;
  if (ABBREVIATION.test(w)) return w.toLocaleUpperCase('es');
  const lower = w.toLocaleLowerCase('es');
  if (!first && CONNECTORS.has(lower)) return lower;
  // Cada tramo separado por guion lleva su inicial ("Sabanas-De-San-Ángel" no: solo el primer tramo es "inicio")
  return lower.split('-').map((part, i) => (i > 0 && CONNECTORS.has(part)) ? part : part.charAt(0).toLocaleUpperCase('es') + part.slice(1)).join('-');
}

/** `"SAN ANDRÉS DE TUMACO, NARIÑO"` → "San Andrés de Tumaco, Nariño"; `"BOGOTÁ, D.C."` → "Bogotá, D.C.". */
export function zoneLabel(sealed: string): string {
  return sealed
    .split(',')
    .map((part) => {
      const lead = part.match(/^\s*/)?.[0] ?? '';
      let first = true;
      const body = part.slice(lead.length).split(/(\s+)/).map((tok) => {
        if (/^\s+$/.test(tok) || tok === '') return tok;
        const out = word(tok, first);
        first = false;
        return out;
      }).join('');
      return lead + body;
    })
    .join(',');
}

/** Para las vistas: `null`/ausente → el texto de siempre ("Sin zona pública"). */
export function zoneOrNone(sealed: string | null | undefined, none: string): string {
  return sealed ? zoneLabel(sealed) : none;
}
