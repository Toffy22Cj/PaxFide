// Ref: Documentos/plan-fase7-pantallas.md §5 B-1; Documentos/diseno-ux-contractual-web-v1.md §6; Documentos/sistema-visual-paxfide-web-enmienda-1.md §4.1–§4.3.
import React from 'react';
import s from './States.module.css';
import { Icon } from './ui/Icons';
import { ChainCubesLoader } from './loaders/ChainCubesLoader';
import { Skeleton } from './loaders/Skeleton';

export type LoadingVariant = 'cubes' | 'skeleton' | 'text';

export type LoadingStateProps = {
  variant?: LoadingVariant;
  text?: string;
  className?: string;
};

export function LoadingState({ variant = 'cubes', text = 'Cargando…', className }: LoadingStateProps = {}) {
  if (variant === 'skeleton') {
    return (
      <div role="status" aria-live="polite" className={[s.loadingContainer, className ?? ''].join(' ')} data-testid="loading-state">
        <Skeleton height={24} width="60%" className={s.skeletonRow} />
        <Skeleton height={16} width="85%" className={s.skeletonRow} />
        <Skeleton height={16} width="40%" className={s.skeletonRow} />
        <span className={s.srOnly}>{text}</span>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div role="status" aria-live="polite" className={[s.loadingNotice, className ?? ''].join(' ')} data-testid="loading-state">
        <span className={s.loadingText}>{text}</span>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className={[s.loadingNotice, className ?? ''].join(' ')} data-testid="loading-state">
      <ChainCubesLoader aria-hidden="true" />
      <span className={s.loadingText}>{text}</span>
    </div>
  );
}

export function ErrorState({ onRetry, text }: { onRetry?: () => void; text?: string }) {
  return (
    <div role="alert" className={[s.notice, s.rejected].join(' ')} data-testid="error-state">
      <Icon name="error" />
      <div className={s.body}>
        <p>{text ?? 'No pudimos cargar la información. Inténtalo de nuevo.'}</p>
        {onRetry && (
          <div className={s.actions}>
            <button type="button" className={s.button} onClick={onRetry}>Reintentar</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ForbiddenState() {
  return (
    <div role="alert" className={[s.notice, s.neutral].join(' ')} data-testid="forbidden-state">
      <Icon name="error" />
      <div className={s.body}>
        <p>No tienes acceso a este recurso.</p>
      </div>
    </div>
  );
}

export function NotFoundState({ message }: { message: string }) {
  return (
    <div role="status" className={[s.notice, s.neutral].join(' ')} data-testid="not-found-state">
      <Icon name="info" />
      <div className={s.body}>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div role="status" className={[s.notice, s.neutral].join(' ')} data-testid="empty-state">
      <Icon name="info" />
      <div className={s.body}>
        <p>{text}</p>
      </div>
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
      <div role="alert" className={[s.notice, s.ambiguous].join(' ')} data-testid="ambiguous-state">
        <Icon name="warning" />
        <div className={s.body}>
          <p>No sabemos si la operación se realizó; revísalo antes de repetirla.</p>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className={[s.notice, s.ambiguous].join(' ')} data-testid="ambiguous-state">
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
  success: 'success',
  info: 'info',
  rejected: 'error',
  ambiguous: 'warning',
};

export function StatusNotice({ variant, title, text, children }: {
  variant: StatusNoticeVariant;
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  const isAlert = variant === 'rejected' || variant === 'ambiguous';
  return (
    <div role={isAlert ? 'alert' : 'status'} className={[s.notice, s[variant]].join(' ')} data-testid={`status-notice-${variant}`}>
      <Icon name={ICON[variant]} />
      <div className={s.body}>
        {title && <strong className={s.title}>{title}</strong>}
        {text && <p>{text}</p>}
        {children}
      </div>
    </div>
  );
}
