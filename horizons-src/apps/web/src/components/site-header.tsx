import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <><div className="announcement">A LITTLE PRACTICE. A SMARTER PICK. A BETTER GAME. <span>LET’S PLAY.</span></div><header className="site-header"><Link to="/" className="brand" aria-label="SmartSelectLabs home"><BrandLogo /></Link><button className="mobile-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open}>{open ? <X /> : <Menu />}</button><nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation" onClick={() => setOpen(false)}><NavLink to="/learn"><span style={{ fontSize: '14px', lineHeight: 'normal', fontWeight: 'normal' }}>Improve your game</span></NavLink><NavLink to="/gear"><span style={{ fontSize: '14px', lineHeight: 'normal', fontWeight: 'normal' }}>Gear &amp; comparisons</span></NavLink><NavLink to="/blog"><span style={{ fontSize: '14px', lineHeight: 'normal', fontWeight: 'normal' }}>The journal</span></NavLink><NavLink to="/about"><span style={{ fontSize: '14px', lineHeight: 'normal', fontWeight: 'normal' }}>About us</span></NavLink><Link className="nav-cta" to="/learn"><span style={{
            fontSize: "14px",
            lineHeight: "normal"
          }}><span style={{
              fontWeight: "normal"
            }}>Find your next level </span><ArrowUpRight size={17} /></span></Link></nav></header></>;
}