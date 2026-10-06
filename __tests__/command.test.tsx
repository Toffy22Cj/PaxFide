import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCommand } from '../src/lib/commands/useCommand';
import * as session from '../src/lib/auth/session';

describe('Command Machine (T-5)', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.spyOn(session, 'handle401');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('timeout -> reintento => mismo commandId', async () => {
    // Simulamos un timeout (fetch arroja error)
    fetchMock.mockRejectedValueOnce(new Error('Timeout'));
    
    const { result } = renderHook(() => useCommand('/api/test'));
    
    await act(async () => {
      await result.current.execute({ data: 1 });
    });

    expect(result.current.state).toBe('AMBIGUOUS');
    const firstCallId = fetchMock.mock.calls[0][1].headers['X-Command-Id'];
    expect(firstCallId).toBeDefined();

    // Reintento
    fetchMock.mockResolvedValueOnce({ status: 200 });
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.state).toBe('SUCCESS');
    const secondCallId = fetchMock.mock.calls[1][1].headers['X-Command-Id'];
    
    // Mismo commandId
    expect(secondCallId).toBe(firstCallId);
  });

  it('4xx -> nueva intención => commandId distinto', async () => {
    // Simulamos rechazo 400
    fetchMock.mockResolvedValueOnce({ status: 400 });
    
    const { result } = renderHook(() => useCommand('/api/test'));
    
    await act(async () => {
      await result.current.execute({ data: 1 });
    });

    expect(result.current.state).toBe('REJECTED');
    const firstCallId = fetchMock.mock.calls[0][1].headers['X-Command-Id'];

    // Para 4xx, retry no hace nada (la UI llama a newIntent o execute de nuevo)
    await act(async () => {
      await result.current.retry();
    });
    // No hay llamada extra
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Usuario corrige formulario y envía de nuevo
    fetchMock.mockResolvedValueOnce({ status: 200 });
    await act(async () => {
      await result.current.execute({ data: 2 });
    });

    expect(result.current.state).toBe('SUCCESS');
    const secondCallId = fetchMock.mock.calls[1][1].headers['X-Command-Id'];
    
    // commandId distinto
    expect(secondCallId).not.toBe(firstCallId);
  });

  it('Aserción negativa: no hay reintento automático', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network Error'));
    
    const { result } = renderHook(() => useCommand('/api/test'));
    
    await act(async () => {
      await result.current.execute({ data: 1 });
    });

    expect(result.current.state).toBe('AMBIGUOUS');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Avanzamos el tiempo para asegurar que no hay reintento automático
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1); // Sigue siendo 1
  });

  it('Aserción negativa: un 5xx nunca es determinista (es AMBIGUOUS)', async () => {
    fetchMock.mockResolvedValueOnce({ status: 503 });
    
    const { result } = renderHook(() => useCommand('/api/test'));
    
    await act(async () => {
      await result.current.execute({ data: 1 });
    });

    // En PaxFide, un 5xx es ambiguo, no rechazado
    expect(result.current.state).toBe('AMBIGUOUS');
  });

  it('Aserción negativa: un rechazado no se reenvía con el mismo commandId', async () => {
    fetchMock.mockResolvedValueOnce({ status: 422 });
    
    const { result } = renderHook(() => useCommand('/api/test'));
    
    await act(async () => {
      await result.current.execute({ data: 1 });
    });

    expect(result.current.state).toBe('REJECTED');

    // Intentar reintentar no dispara la petición
    await act(async () => {
      await result.current.retry();
    });
    
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('401 causa logout local (T-1) y pierde la intención', async () => {
    fetchMock.mockResolvedValueOnce({ status: 401 });
    
    const { result } = renderHook(() => useCommand('/api/test', false));
    
    await act(async () => {
      await result.current.execute({ data: 1 });
    });

    expect(session.handle401).toHaveBeenCalledWith(false);
    expect(result.current.state).toBe('IDLE');
    expect(result.current.commandId).toBeNull();
  });

  it('Cerrar limpia el commandId', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Timeout'));
    
    const { result } = renderHook(() => useCommand('/api/test'));
    
    await act(async () => {
      await result.current.execute({ data: 1 });
    });

    expect(result.current.state).toBe('AMBIGUOUS');
    expect(result.current.commandId).not.toBeNull();

    act(() => {
      result.current.close();
    });

    expect(result.current.state).toBe('IDLE');
    expect(result.current.commandId).toBeNull();
  });
});
