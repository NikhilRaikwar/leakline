'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';
import { Wordmark } from './ui';

const navigation = [
  { label: 'Overview', path: '' },
  { label: 'New audit', path: '/new' },
  { label: 'Audit runs', path: '/audit-runs' },
];

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [runId, setRunId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [backend, setBackend] = useState<'checking' | 'ready' | 'offline'>('checking');

  useEffect(() => {
    const updateRun = () => setRunId(localStorage.getItem('leakline_run') ?? '');
    updateRun();
    window.addEventListener('leakline-run-updated', updateRun);
    const controller = new AbortController();
    api<{ status: string }>('/health/ready', undefined, controller.signal)
      .then(() => setBackend('ready'))
      .catch(() => setBackend('offline'));
    return () => { controller.abort(); window.removeEventListener('leakline-run-updated', updateRun); };
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  const runBase = runId ? `/app/runs/${encodeURIComponent(runId)}` : '/app/new';
  const runLinks = [
    { label: 'Graph explorer', href: `${runBase}/graph` },
    { label: 'AI investigation', href: `${runBase}/investigation` },
    { label: 'Repair plans', href: `${runBase}/repair` },
    { label: 'Verification', href: `${runBase}/verification` },
    { label: 'Exports', href: `${runBase}/exports` },
  ];

  return <div className="workspace-shell">
    <header className="workspace-mobile-top"><button className="mobile-menu-button workspace-menu-trigger" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close workspace navigation' : 'Open workspace navigation'} onClick={() => setMenuOpen(value => !value)}><span /><span /></button><Wordmark /><span className={`connection-indicator ${backend}`}><i />{backend === 'ready' ? 'API ready' : backend === 'checking' ? 'Checking API' : 'API offline'}</span></header>
    <aside className={`workspace-sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Wordmark /><span className="workspace-word">DATA WORKSPACE</span></div>
      <p className="sidebar-label">Workspace</p>
      <nav className="sidebar-nav" aria-label="Workspace navigation">
        {navigation.map(item => {
          const href = `/app${item.path}` || '/app';
          const active = item.path === '' ? pathname === '/app' : pathname === href;
          return <Link key={item.label} href={href} aria-current={active ? 'page' : undefined} className={active ? 'sidebar-link active' : 'sidebar-link'}><span className={`nav-mark nav-${item.label.toLowerCase().replaceAll(' ', '-')}`} aria-hidden="true" />{item.label}</Link>;
        })}
        <p className="sidebar-label sidebar-label-run">Current run</p>
        {runLinks.map(item => <Link key={item.label} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={pathname === item.href ? 'sidebar-link active' : 'sidebar-link'}><span className="nav-mark" aria-hidden="true" />{item.label}</Link>)}
      </nav>
      {runId && <div className="sidebar-run-ref"><span>Last opened run</span><Link className="mono" href={runBase}>{runId.slice(0, 8)}…</Link></div>}
      <div className="sidebar-bottom"><a href="https://github.com/NikhilRaikwar/leakline/tree/main/docs" target="_blank" rel="noreferrer">Documentation <span aria-hidden="true">↗</span></a><span className={`connection-indicator ${backend}`}><i />{backend === 'ready' ? 'FalkorDB connected' : backend === 'checking' ? 'Checking connection' : 'Backend unavailable'}</span><Link href="/">Back to website</Link></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="workspace-main">
      <header className="workspace-topbar"><div><span className="topbar-kicker">LEAKLINE / WORKSPACE</span><span className="topbar-context">{pathname === '/app' ? 'Overview' : pathname.includes('/new') ? 'New audit' : pathname.includes('/audit-runs') ? 'Audit runs' : 'Dataset audit'}</span></div><div className="topbar-right">{runId && <Link href={runBase} className="topbar-run mono">{runId.slice(0, 8)}…</Link>}<Link className="btn-primary topbar-action" href="/app/new">New audit <span aria-hidden="true">+</span></Link></div></header>
      <main className="workspace-content">{children}</main>
    </div>
  </div>;
}
