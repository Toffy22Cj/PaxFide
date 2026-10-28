// Ref: plan-fase7-fidelidad.md D-F10: la bienvenida se muestra una vez, en el primer inicio de sesión tras crear la
// cuenta EN ESTA PESTAÑA. El aviso vive en memoria (como el trackingCode, D2): no se guarda nada en el navegador y
// recargar lo pierde.
type Stage = 'none' | 'registered' | 'pending';
let stage: Stage = 'none';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** La cuenta se acaba de crear en esta pestaña. */
export function markRegistered(): void { stage = 'registered'; notify(); }

/** El inicio de sesión salió bien: si la cuenta se creó en esta pestaña, toca la bienvenida (una sola vez). */
export function onLoginSucceeded(): void {
  if (stage === 'registered') { stage = 'pending'; notify(); }
}

export function isWelcomePending(): boolean { return stage === 'pending'; }

/** "Continuar": la bienvenida no vuelve a salir. */
export function dismissWelcome(): void { stage = 'none'; notify(); }

export function subscribeWelcome(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Solo para los tests. */
export function resetWelcomeForTests(): void { stage = 'none'; listeners.clear(); }
