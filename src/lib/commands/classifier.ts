export type CommandResponseCategory = 'SUCCESS' | 'REJECTED' | 'AMBIGUOUS' | 'AUTH_ERROR';

export function classifyCommandResponse(
  status: number | null, 
  error?: Error
): CommandResponseCategory {
  if (error) {
    return 'AMBIGUOUS'; // Timeout, network error, etc
  }
  if (status === null) {
    return 'AMBIGUOUS';
  }
  if (status >= 200 && status < 300) {
    return 'SUCCESS';
  }
  if (status === 401) {
    return 'AUTH_ERROR';
  }
  if (status >= 400 && status < 500) {
    return 'REJECTED';
  }
  if (status >= 500) {
    return 'AMBIGUOUS';
  }
  return 'AMBIGUOUS';
}
