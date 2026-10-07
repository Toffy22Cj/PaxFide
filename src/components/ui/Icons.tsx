import React from 'react';

/** Conjunto cerrado de 5 iconos SVG propios (§3.4): 20 px, `currentColor`, siempre con texto al lado. */
type IconName = 'info' | 'warning' | 'error' | 'success' | 'close';

const PATHS: Record<IconName, React.ReactNode> = {
  info: (<><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 9v5M10 6.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>),
  warning: (<><path d="M10 2.5 18 17H2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M10 8v4M10 14.3v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>),
  error: (<><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m7 7 6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>),
  success: (<><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m6.5 10.2 2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>),
  close: (<path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />),
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
      {PATHS[name]}
    </svg>
  );
}
