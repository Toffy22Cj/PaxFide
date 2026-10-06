import { useState, useCallback, useRef } from 'react';
import { handle401 } from '../auth/session';
import { classifyCommandResponse } from './classifier';

export type CommandState = 'IDLE' | 'SENDING' | 'REJECTED' | 'AMBIGUOUS' | 'SUCCESS';

export interface CommandResult {
  state: CommandState;
  execute: (payload: any) => Promise<void>;
  retry: () => Promise<void>;
  close: () => void;
  newIntent: () => void;
  errorMsg?: string;
  commandId?: string | null;
}

export function useCommand(endpoint: string, isTrackingRoute: boolean = false): CommandResult {
  const [state, setState] = useState<CommandState>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string>();
  
  // commandId por intención, en memoria
  const commandIdRef = useRef<string | null>(null);
  const payloadRef = useRef<any>(null);

  const performFetch = async (id: string, payload: any) => {
    setState('SENDING');
    let status: number | null = null;
    let fetchError: Error | undefined;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Command-Id': id
        },
        body: JSON.stringify(payload)
      });
      status = response.status;
    } catch (e: any) {
      fetchError = e;
    }

    const category = classifyCommandResponse(status, fetchError);

    if (category === 'AUTH_ERROR') {
      handle401(isTrackingRoute);
      // La intención se pierde
      commandIdRef.current = null;
      payloadRef.current = null;
      setState('IDLE');
      return;
    }

    if (category === 'SUCCESS') {
      setState('SUCCESS');
      commandIdRef.current = null;
      payloadRef.current = null;
    } else if (category === 'REJECTED') {
      setState('REJECTED');
      setErrorMsg('La operación fue rechazada.');
    } else if (category === 'AMBIGUOUS') {
      setState('AMBIGUOUS');
      setErrorMsg('No sabemos si la operación se realizó; revísalo antes de repetirla.');
    }
  };

  const execute = useCallback(async (payload: any) => {
    const newId = crypto.randomUUID();
    commandIdRef.current = newId;
    payloadRef.current = payload;
    await performFetch(newId, payload);
  }, [endpoint]);

  const retry = useCallback(async () => {
    if (state !== 'AMBIGUOUS' || !commandIdRef.current) return;
    await performFetch(commandIdRef.current, payloadRef.current);
  }, [state, endpoint]);

  const close = useCallback(() => {
    // "Cerrar" no significa "la operación falló": significa que el usuario abandona la intención
    commandIdRef.current = null;
    payloadRef.current = null;
    setState('IDLE');
  }, []);

  const newIntent = useCallback(() => {
    commandIdRef.current = null;
    payloadRef.current = null;
    setState('IDLE');
  }, []);

  return { 
    state, 
    execute, 
    retry, 
    close, 
    newIntent, 
    errorMsg, 
    commandId: commandIdRef.current 
  };
}
