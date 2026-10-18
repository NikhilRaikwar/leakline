'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '../lib/api';
import { Wordmark } from './ui';

const validRunId = (value: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    Overview: 'M3 10 12 3l9 7v10H3z M9 20v-7h6v7',
    'New audit': 'M12 5v14 M5 12h14',
    'Audit runs': 'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5',
    'Graph explorer': 'M6 6l12 3-6 10L6 6 M6 6l-3 9 9 4 M18 9l3 9-9 1',
    'AI investigation': 'M10 3 3 10l7 11 11-11L10 3 M10 8v6 M7 11h6',
    'Findings & evidence': 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h5',
    'Repair plans': 'm14 5 5-2-1 6-5 3-7 9-3-3 8-8 3-5',
    Verification: 'M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7L12 3 M7 12l3 3 6-6',
    Exports: 'M12 3v12 M7 10l5 5 5-5 M4 15v6h16v-6',
  };
  return <svg className="sidebar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.Overview} /></svg>;
}

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
    const updateRun = () => {
      try { const stored = localStorage.getItem('leakline_run') ?? ''; setRunId(validRunId(stored) ? stored : ''); }
      catch { setRunId(''); }
    };
    updateRun();
    window.addEventListener('leakline-run-updated', updateRun);
    const controller = new AbortController();
    api<{ status: string }>('/health/ready', undefined, controller.signal)
      .then(() => setBackend('ready'))
      .catch(() => setBackend('offline'));
    return () => { controller.abort(); window.removeEventListener('leakline-run-updated', updateRun); };
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  const routeId = pathname.match(/^\/app\/runs\/([^/]+)/)?.[1] ?? '';
  const currentRunId = validRunId(routeId) ? routeId : runId;
  const runBase = currentRunId ? `/app/runs/${encodeURIComponent(currentRunId)}` : '';
  const runLinks = [
    { label: 'Graph explorer', href: `${runBase}/graph` },
    { label: 'Findings & evidence', href: `${runBase}/evidence` },
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
          return <Link key={item.label} href={href} aria-current={active ? 'page' : undefined} className={active ? 'sidebar-link active' : 'sidebar-link'}><NavIcon name={item.label} />{item.label}</Link>;
        })}
        <p className="sidebar-label sidebar-label-run">Current run</p>
        {runLinks.map(item => currentRunId ? <Link key={item.label} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={pathname === item.href ? 'sidebar-link active' : 'sidebar-link'}><NavIcon name={item.label} />{item.label}</Link> : <span key={item.label} className="sidebar-link unavailable" aria-disabled="true"><NavIcon name={item.label} />{item.label}</span>)}
        {!currentRunId && <div className="sidebar-empty-run"><p>No audit selected</p><span>Create an audit or open one from your history to explore its results.</span><Link href="/app/new">Create an audit →</Link></div>}
      </nav>
      {currentRunId && <div className="sidebar-run-ref"><span>Selected audit</span><Link className="mono" href={runBase}>{currentRunId.slice(0, 8)}… <span aria-hidden="true">↗</span></Link></div>}
      <div className="sidebar-bottom"><a href="https://github.com/NikhilRaikwar/leakline/tree/main/docs" target="_blank" rel="noreferrer">Documentation <span aria-hidden="true">↗</span></a><span className={`connection-indicator ${backend}`}><i />{backend === 'ready' ? 'FalkorDB connected' : backend === 'checking' ? 'Checking connection' : 'Backend unavailable'}</span><Link href="/">Back to website</Link></div>
    </aside>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="workspace-main">
      <header className="workspace-topbar"><div><span className="topbar-kicker">LEAKLINE / WORKSPACE</span><span className="topbar-context">{pathname === '/app' ? 'Overview' : pathname.includes('/new') ? 'New audit' : pathname.includes('/audit-runs') ? 'Audit runs' : runLinks.find(item => pathname === item.href)?.label ?? 'Dataset audit'}</span></div><div className="topbar-right">{currentRunId && <Link href={runBase} className="topbar-run mono">{currentRunId.slice(0, 8)}…</Link>}<Link className="btn-primary topbar-action" href="/app/new">New audit <span aria-hidden="true">+</span></Link></div></header>
      <main className="workspace-content">{children}</main>
    </div>
  </div>;
}
