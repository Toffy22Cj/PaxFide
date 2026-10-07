import React from 'react';
import { Button } from './Button';
import { InfoIcon, WarningIcon, ErrorIcon, CheckIcon } from './Icons';

export function LoadingState() {
  return (
    <div aria-live="polite">
      Cargando…
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <StatusNotice 
        variant="rejected" 
        text="No pudimos cargar la información. Inténtalo de nuevo." 
      />
      {onRetry && (
        <div>
          <Button variant="primary" onClick={onRetry}>Reintentar</Button>
        </div>
      )}
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
      <StatusNotice 
        variant="ambiguous" 
        text="No sabemos si la operación se realizó; revísalo antes de repetirla." 
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <StatusNotice 
        variant="ambiguous" 
        title="No pudimos confirmar la operación"
        text="Puede que se haya realizado. Revisa antes de repetirla." 
      />
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button variant="primary" onClick={onRetry}>Reintentar</Button>
        <Button variant="secondary" onClick={() => { setClosed(true); onClose(); }}>Cerrar</Button>
      </div>
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
  
  let Icon = InfoIcon;
  if (variant === 'success') Icon = CheckIcon;
  else if (variant === 'rejected') Icon = ErrorIcon;
  else if (variant === 'ambiguous') Icon = WarningIcon;

  return (
    <div role={isAlert ? "alert" : "status"} className={`pax-status-notice pax-status-${variant}`}>
      <div className="pax-status-notice-icon">
        <Icon />
      </div>
      <div className="pax-status-notice-content">
        {title && <h3 className="pax-status-notice-title">{title}</h3>}
        <p className="pax-status-notice-text">{text}</p>
      </div>
    </div>
  );
}
