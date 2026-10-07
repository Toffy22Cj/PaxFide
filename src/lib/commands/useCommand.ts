import { useState, useCallback, useRef } from 'react';
import { handle401 } from '../auth/session';
import { apiRequest, AuthMode, ProblemInfo } from '../api/http';
import { classifyCommandResponse } from './classifier';

/**
 * Máquina del comando web sin Outbox (ADR-046 D6; `front-fase2` §10, P-W1/P-W1a/P-W1b).
 *
 * - `Command-Id` (UUID) generado en cliente **por intención**, solo en memoria; se pierde al recargar.
 * - Ambiguo → "Reintentar" con el **mismo** `Command-Id`, o "Cerrar" sin enviar nada.
 * - Rechazado → nunca se reenvía; una nueva intención lleva un `Command-Id` **nuevo**.
 * - **Nunca** hay reintento automático.
 * - El backend exige la cabecera `Command-Id` (B6-0, `CommandIdArgumentResolver`); sin ella responde 400.
 */
export type CommandState = 'IDLE' | 'SENDING' | 'REJECTED' | 'AMBIGUOUS' | 'SUCCESS';

export interface CommandRequest {
  path: string;
  body: unknown;
  auth?: AuthMode;
}

export interface CommandRejection {
  status: number;
  problem: ProblemInfo;
}

export interface CommandResult<TRes = unknown> {
  state: CommandState;
  execute: (payload: unknown) => Promise<void>;
  retry: () => Promise<void>;
  close: () => void;
  newIntent: () => void;
  data: TRes | null;
  location: string | null;
  rejection: CommandRejection | null;
  commandId: string | null;
}

export const COMMAND_ID_HEADER = 'Command-Id';

type Builder = string | ((payload: unknown) => CommandRequest);

function build(builder: Builder, payload: unknown): CommandRequest {
  return typeof builder === 'string' ? { path: builder, body: payload, auth: 'required' } : builder(payload);
}

export function useCommand<TRes = unknown>(builder: Builder, isTrackingRoute: boolean = false): CommandResult<TRes> {
  const [state, setState] = useState<CommandState>('IDLE');
  const [data, setData] = useState<TRes | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [rejection, setRejection] = useState<CommandRejection | null>(null);
  const [commandId, setCommandId] = useState<string | null>(null);

  const commandIdRef = useRef<string | null>(null);
  const requestRef = useRef<CommandRequest | null>(null);
  const builderRef = useRef(builder);
  builderRef.current = builder;

  const forget = () => {
    commandIdRef.current = null;
    requestRef.current = null;
    setCommandId(null);
  };

  const perform = async (id: string, request: CommandRequest) => {
    setState('SENDING');
    setRejection(null);
    const result = await apiRequest<TRes>({
      path: request.path,
      method: 'POST',
      body: request.body,
      auth: request.auth ?? 'required',
      headers: { [COMMAND_ID_HEADER]: id },
    });

    const category = result.kind === 'network'
      ? classifyCommandResponse(null, new Error('network'))
      : classifyCommandResponse(result.status);

    if (category === 'AUTH_ERROR') {
      handle401(isTrackingRoute);
      // P-W1a: la intención en memoria se pierde
      forget();
      setState('IDLE');
      return;
    }
    if (category === 'SUCCESS' && result.kind === 'ok') {
      setData(result.data ?? null);
      setLocation(result.location);
      setState('SUCCESS');
      forget();
      return;
    }
    if (category === 'REJECTED' && result.kind === 'error') {
      setRejection({ status: result.status, problem: result.problem });
      setState('REJECTED');
      return;
    }
    setState('AMBIGUOUS');
  };

  const execute = useCallback(async (payload: unknown) => {
    const id = crypto.randomUUID();
    const request = build(builderRef.current, payload);
    commandIdRef.current = id;
    requestRef.current = request;
    setCommandId(id);
    setData(null);
    await perform(id, request);
  }, []);

  const retry = useCallback(async () => {
    if (state !== 'AMBIGUOUS' || !commandIdRef.current || !requestRef.current) return;
    await perform(commandIdRef.current, requestRef.current);
  }, [state]);

  const close = useCallback(() => {
    // "Cerrar" no significa "falló": el usuario abandona la intención sin enviar nada más
    forget();
    setRejection(null);
    setState('IDLE');
  }, []);

  const newIntent = useCallback(() => {
    forget();
    setRejection(null);
    setData(null);
    setState('IDLE');
  }, []);

  return { state, execute, retry, close, newIntent, data, location, rejection, commandId };
}
