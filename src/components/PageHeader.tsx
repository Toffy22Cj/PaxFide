import * as React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function PageHeader({ title, subtitle, className = '' }: PageHeaderProps) {
  return (
    <header className={`pax-page-header ${className}`}>
      <h1 className="pax-page-title">{title}</h1>
      {subtitle && <p className="pax-page-subtitle">{subtitle}</p>}
    </header>
  );
}
