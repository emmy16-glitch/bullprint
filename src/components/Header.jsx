import { useState } from 'react'
import TokenLogo from './TokenLogo'
import { Icon } from './Icons'

const nav = [['Home', '#top'], ['Live Distributions', '#live-distributions'], ['About', '#about'], ['Safety', '#safety'], ['FAQ', '#faq']]

export default function Header() {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#top" aria-label="$ANSEM Wallet Checker home">
          <TokenLogo />
          <span><strong>$ANSEM</strong><small>WALLET CHECKER</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">{nav.map(([label, href]) => <a key={label} href={href}>{label}</a>)}</nav>
        <div className="header-actions">
          <button className="theme-toggle" type="button" aria-label="Appearance control"><Icon name="sun"/><Icon name="moon"/></button>
          <a className="primary-btn header-check" href="#checker">Check Wallet</a>
          <button className="menu-btn" type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu">Menu</button>
        </div>
      </div>
      {open && <nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation">{nav.map(([label, href]) => <a onClick={() => setOpen(false)} key={label} href={href}>{label}</a>)}<a className="primary-btn" href="#checker" onClick={() => setOpen(false)}>Check Wallet</a></nav>}
    </header>
  )
}
