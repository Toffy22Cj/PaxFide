'use client';

import React, { useEffect, useState } from 'react';
import { AmbiguousState, StatusNotice } from './States';
import { rejectionMessage } from '../lib/api/messages';
import type { CommandResult } from '../lib/commands/useCommand';

/**
 * Presentación común de los estados no exitosos de un comando (P-W1b; §6). Tras "Cerrar" un ambiguo, la advertencia
 * se mantiene visible hasta la siguiente intención: cerrar no significa que la operación falló.
 */
export function CommandFeedback({ command }: { command: CommandResult<any> }) {
  const [closedAmbiguous, setClosedAmbiguous] = useState(false);

  useEffect(() => {
    if (command.state === 'SENDING') setClosedAmbiguous(false);
  }, [command.state]);

  if (command.state === 'REJECTED' && command.rejection) {
    return <StatusNotice variant="rejected" text={rejectionMessage(command.rejection.status, command.rejection.problem)} />;
  }
  if (command.state === 'AMBIGUOUS') {
    return <AmbiguousState onRetry={() => { void command.retry(); }} onClose={() => { setClosedAmbiguous(true); command.close(); }} />;
  }
  if (closedAmbiguous) {
    return <StatusNotice variant="ambiguous" text="No sabemos si la operación se realizó; revísalo antes de repetirla." />;
  }
  return null;
}
