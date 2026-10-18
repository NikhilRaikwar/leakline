'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Wordmark } from './ui';

export default function MarketingNav() {
  const [open, setOpen] = useState(false);
  return <header className="marketing-header">
    <nav className="marketing-nav page-shell" aria-label="Main navigation">
      <Wordmark />
      <div className={`marketing-links ${open ? 'is-open' : ''}`}>
        <a href="#product" onClick={() => setOpen(false)}>Product</a>
        <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a>
        <a href="#features" onClick={() => setOpen(false)}>Features</a>
        <a href="https://github.com/NikhilRaikwar/leakline/tree/main/docs" target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Docs</a>
        <a href="https://github.com/NikhilRaikwar/leakline" target="_blank" rel="noreferrer">GitHub</a>
        <Link className="nav-launch" href="/app" onClick={() => setOpen(false)}>Launch app <span aria-hidden="true">↗</span></Link>
      </div>
      <button className="mobile-menu-button" type="button" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(value => !value)}><span /><span /></button>
    </nav>
  </header>;
}
