'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as session from '../lib/auth/session';
import { acceptInvitation, AcceptOutcome } from '../lib/api/members';
import { captureInvitationToken, clearInvitationToken, getInvitationToken } from '../lib/invitations/token';
import { roleLabel } from '../lib/labels';
import { isSurfaceEnabled } from '../lib/routing/surfaces';
import { Actions, PageHeader, Surface } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import { StatusNotice } from '../components/States';

const NOT_ACCEPTABLE = 'Esta invitación no es válida para tu cuenta: puede haber caducado, haberse usado, haberse revocado o ser para otro correo. Pide a la organización una nueva.';

/**
 * `/invitaciones` (Autorización (2) §2.4; DW-48). El token se toma del fragmento y se borra de la barra al cargar; vive
 * solo en memoria. Sin sesión: se pide iniciar sesión o crear la cuenta con el correo invitado y se vuelve aquí. Con
 * sesión: se acepta con un botón (la aceptación no es automática). Al terminar, el token se descarta.
 */
export function InvitationScreen({ client = acceptInvitation }: { client?: typeof acceptInvitation }) {
  const router = useRouter();
  const state = useSyncExternalStore(session.subscribe, session.getState, () => 'RESTORING' as session.MachineState);
  const [hasToken, setHasToken] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<AcceptOutcome | null>(null);

  useEffect(() => {
    const capture = () => {
      if (captureInvitationToken()) setResult(null);
      setHasToken(getInvitationToken() !== null);
    };
    capture();
    // Abrir otro enlace de invitación con esta página ya abierta solo cambia el fragmento (no se vuelve a montar)
    window.addEventListener('hashchange', capture);
    return () => window.removeEventListener('hashchange', capture);
  }, []);

  // Si la sesión se cierra (también por caducidad), el token se descarta (módulo del token)
  useEffect(() => {
    if (state === 'LOGGED_OUT' && result === null) setHasToken(getInvitationToken() !== null);
  }, [state, result]);

  const go = (path: string) => {
    session.setPostLoginDestination('/invitaciones');
    router.push(path);
  };

  const accept = async () => {
    const token = getInvitationToken();
    if (!token) { setHasToken(false); return; }
    setSending(true);
    const r = await client(token);
    setSending(false);
    if (r.kind !== 'error' && r.kind !== 'unauthorized') clearInvitationToken();
    setResult(r);
  };

  return (
    <div>
      <PageHeader title="Invitación a una organización" />
      {result?.kind === 'ok' && (
        <StatusNotice variant="success" title="Invitación aceptada">
          <p>Ya formas parte de la organización{result.roles.length > 0 ? ` como ${result.roles.map(roleLabel).join(', ').toLowerCase()}` : ''}.</p>
          <Link href="/panel">Ir al panel</Link>
        </StatusNotice>
      )}
      {result?.kind === 'not-acceptable' && <StatusNotice variant="rejected" text={NOT_ACCEPTABLE} />}
      {result?.kind === 'already-member' && (
        <StatusNotice variant="rejected" text="Tu cuenta ya pertenece a una organización: no puede aceptar esta invitación." />
      )}
      {result?.kind === 'error' && (
        <StatusNotice variant="rejected" text="No pudimos aceptar la invitación. Inténtalo de nuevo." />
      )}
      {result === null && !hasToken && state !== 'RESTORING' && (
        <StatusNotice variant="info" text="No hay ninguna invitación en esta página. Abre el enlace del correo que recibiste." />
      )}
      {hasToken && state === 'LOGGED_OUT' && (
        <Surface title="Tienes una invitación">
          <p>Para aceptarla, inicia sesión con la cuenta del correo al que llegó la invitación, o crea una cuenta con ese
            correo. Después volverás aquí. No recargues esta página: la invitación solo se conserva en esta pestaña.</p>
          <Actions>
            <Button onClick={() => go('/login')}>Iniciar sesión</Button>
            {isSurfaceEnabled('/register') && <Button variant="secondary" onClick={() => go('/register')}>Crear cuenta</Button>}
          </Actions>
        </Surface>
      )}
      {hasToken && state === 'AUTHENTICATED' && (result === null || result.kind === 'error') && (
        <Surface title="Tienes una invitación">
          <p>Al aceptarla, tu cuenta pasa a formar parte de la organización que te invitó, con el papel indicado en el correo.</p>
          <Actions><Button onClick={() => void accept()} sending={sending}>Aceptar invitación</Button></Actions>
        </Surface>
      )}
    </div>
  );
}
