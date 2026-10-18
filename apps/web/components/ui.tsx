import Link from 'next/link';
import type { ReactNode } from 'react';

export function Wordmark({ light = false }: { light?: boolean }) {
  return <Link href="/" aria-label="Leakline home" className={`wordmark ${light ? 'wordmark-light' : ''}`}>leakline</Link>;
}

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
    {diagonal ? <path d="M4 12 12 4M5 4h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      : <path d="M2.5 8h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}

export function Check({ className = '' }: { className?: string }) {
  return <svg className={className} aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="m3 8.2 3.1 3.1L13 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warning' | 'bad' }) {
  return <span className="status-pill"><span className={`status-dot ${tone === 'good' ? 'ok' : tone === 'warning' ? 'warn' : tone === 'bad' ? 'fail' : ''}`} />{children}</span>;
}

export function SectionHeading({ eyebrow, title, description, align = 'left' }: { eyebrow?: string; title: string; description?: string; align?: 'left' | 'center' }) {
  return <div className={`section-heading ${align === 'center' ? 'section-heading-center' : ''}`}>
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}
    <h2 className="editorial-heading">{title}</h2>
    {description && <p className="section-description">{description}</p>}
  </div>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">—</span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function PageError({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return <div role="alert" className="error-panel"><div><strong>We couldn’t complete that request.</strong><p>{children}</p></div>{onRetry && <button className="btn-secondary" onClick={onRetry}>Try again</button>}</div>;
}
