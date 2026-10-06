import React from 'react';

export function LoadingState() {
  return (
    <div aria-live="polite">
      Cargando…
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div style={{ backgroundColor: 'var(--danger-50)', color: 'var(--danger-700)' }}>
      <p>No pudimos cargar la información. Inténtalo de nuevo.</p>
      {onRetry && <button onClick={onRetry}>Reintentar</button>}
    </div>
  );
}

export function ForbiddenState() {
  return (
    <div style={{ backgroundColor: 'var(--white)', color: 'var(--brand-neutral-700)' }}>
      <p>No tienes acceso a este recurso.</p>
    </div>
  );
}

export function NotFoundState({ message }: { message: string }) {
  return (
    <div style={{ backgroundColor: 'var(--white)', color: 'var(--brand-neutral-700)' }}>
      <p>{message}</p>
    </div>
  );
}

export function AmbiguousState({
  onRetry,
  onClose
}: {
  onRetry: () => void;
  onClose: () => void;
}) {
  const [closed, setClosed] = React.useState(false);

  if (closed) {
    return (
      <div style={{ backgroundColor: 'var(--brand-yellow-50)', color: 'var(--brand-green-900)' }}>
        <p>No sabemos si la operación se realizó; revísalo antes de repetirla.</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--brand-yellow-50)', color: 'var(--brand-green-900)' }}>
      <h2 style={{ color: 'var(--brand-yellow-900)' }}>No pudimos confirmar la operación</h2>
      <p>Puede que se haya realizado. Revisa antes de repetirla.</p>
      <button onClick={onRetry}>Reintentar</button>
      <button onClick={() => { setClosed(true); onClose(); }}>Cerrar</button>
    </div>
  );
}

export type StatusNoticeVariant = 'success' | 'info' | 'rejected' | 'ambiguous';

export function StatusNotice({
  variant,
  title,
  text
}: {
  variant: StatusNoticeVariant;
  title?: string;
  text: string;
}) {
  const isAlert = variant === 'rejected' || variant === 'ambiguous';
  
  let bg = 'var(--brand-green-50)';
  let color = 'var(--brand-green-900)';
  let titleColor = color;

  if (variant === 'info') {
    bg = 'var(--brand-blue-50)';
    color = 'var(--brand-blue-800)';
    titleColor = color;
  } else if (variant === 'rejected') {
    bg = 'var(--danger-50)';
    color = 'var(--danger-700)';
    titleColor = color;
  } else if (variant === 'ambiguous') {
    bg = 'var(--brand-yellow-50)';
    color = 'var(--brand-green-900)';
    titleColor = 'var(--brand-yellow-900)';
  }

  return (
    <div role={isAlert ? "alert" : "status"} style={{ backgroundColor: bg, color }}>
      {title && <strong style={{ color: titleColor }}>{title}</strong>}
      <p>{text}</p>
    </div>
  );
}
