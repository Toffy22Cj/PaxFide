import React from 'react';
import s from './ui.module.css';

/** Una sola `h1` por página (§4, §7). */
export function PageHeader({ title, reference, testId }: { title: string; reference?: string; testId?: string }) {
  return (
    <header className={s.pageHeader}>
      <h1 className={s.pageTitle} data-testid={testId}>{title}</h1>
      {reference && <p className={s.pageRef}>{reference}</p>}
    </header>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: React.ReactNode; testId?: string }[] }) {
  return (
    <dl className={s.dl}>
      {items.map((i) => (
        <React.Fragment key={i.label}>
          <dt>{i.label}</dt>
          <dd data-testid={i.testId}>{i.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Surface({ title, children, headingLevel = 2 }: { title?: string; children: React.ReactNode; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section className={s.surface}>
      {title && <H className={s.sectionTitle}>{title}</H>}
      {children}
    </section>
  );
}

export function Actions({ children }: { children: React.ReactNode }) {
  return <div className={s.actions}>{children}</div>;
}

export const uiClasses = s;
