import React from 'react';
import s from './States.module.css';
import { Icon } from './ui/Icons';

/** Estados globales (`diseno-ux-contractual-web-v1.md` §6). Colores de `sistema-visual` §4; ambiguo nunca en rojo. */

export function LoadingState() {
  return <div aria-live="polite" className={s.notice}>Cargando…</div>;
}

export function ErrorState({ onRetry, text }: { onRetry?: () => void; text?: string }) {
  return (
    <div role="alert" className={[s.notice, s.rejected].join(' ')}>
      <Icon name="error" />
      <div className={s.body}>
        <p>{text ?? 'No pudimos cargar la información. Inténtalo de nuevo.'}</p>
        {onRetry && <div className={s.actions}><button type="button" className={s.button} onClick={onRetry}>Reintentar</button></div>}
      </div>
    </div>
  );
}

export function ForbiddenState() {
  return (
    <div className={[s.notice, s.neutral].join(' ')}>
      <p>No tienes acceso a este recurso.</p>
    </div>
  );
}

export function NotFoundState({ message }: { message: string }) {
  return (
    <div className={[s.notice, s.neutral].join(' ')}>
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className={[s.notice, s.neutral].join(' ')} data-testid="empty-state">
      <p>{text}</p>
    </div>
  );
}

/**
 * El backend todavía no expone el endpoint que esta pantalla necesita (registrado en
 * `Documentos/solicitudes-backend.md`). No se muestran datos de ejemplo ni "próximamente" con fecha.
 */
export function UnavailableState({ what }: { what: string }) {
  return (
    <div role="status" className={[s.notice, s.info].join(' ')} data-testid="unavailable-state">
      <Icon name="info" />
      <div className={s.body}>
        <span className={s.title}>No disponible</span>
        <p>{what} todavía no está disponible en el servicio.</p>
      </div>
    </div>
  );
}

export function AmbiguousState({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const [closed, setClosed] = React.useState(false);

  if (closed) {
    return (
      <div role="alert" className={[s.notice, s.ambiguous].join(' ')}>
        <Icon name="warning" />
        <p>No sabemos si la operación se realizó; revísalo antes de repetirla.</p>
      </div>
    );
  }

  return (
    <div role="alert" className={[s.notice, s.ambiguous].join(' ')}>
      <Icon name="warning" />
      <div className={s.body}>
        <h2 className={s.title} style={{ fontSize: 'inherit', margin: 0 }}>No pudimos confirmar la operación</h2>
        <p>Puede que se haya realizado. Revisa antes de repetirla.</p>
        <div className={s.actions}>
          <button type="button" className={s.button} onClick={onRetry}>Reintentar</button>
          <button type="button" className={s.button} onClick={() => { setClosed(true); onClose(); }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export type StatusNoticeVariant = 'success' | 'info' | 'rejected' | 'ambiguous';

const ICON: Record<StatusNoticeVariant, 'success' | 'info' | 'error' | 'warning'> = {
  success: 'success', info: 'info', rejected: 'error', ambiguous: 'warning',
};

export function StatusNotice({ variant, title, text, children }: {
  variant: StatusNoticeVariant;
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  const isAlert = variant === 'rejected' || variant === 'ambiguous';
  return (
    <div role={isAlert ? 'alert' : 'status'} className={[s.notice, s[variant]].join(' ')}>
      <Icon name={ICON[variant]} />
      <div className={s.body}>
        {title && <strong className={s.title}>{title}</strong>}
        {text && <p>{text}</p>}
        {children}
      </div>
    </div>
  );
}
