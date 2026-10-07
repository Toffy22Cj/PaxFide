import * as React from 'react';

export interface DefinitionListProps {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}

export function DefinitionList({ items, className = '' }: DefinitionListProps) {
  return (
    <dl className={`pax-dl ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="pax-dl-group" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <dt className="pax-dt">{item.label}</dt>
          <dd className="pax-dd">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
