import { useEffect, useState } from 'react'
import TokenLogo from './TokenLogo'
import { Icon } from './Icons'

const nav = [
  ['Home', '#top'],
  ['Live Distributions', '#live-distributions'],
  ['About', '#about'],
  ['Safety', '#safety'],
  ['FAQ', '#faq'],
]

function initialTheme() {
  try {
    const saved = window.localStorage.getItem('ansem-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // Storage can be unavailable in private browsing or hardened browsers.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function Header() {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    const themeColor = document.querySelector('meta[name="theme-color"]')
    themeColor?.setAttribute('content', theme === 'dark' ? '#07101B' : '#F5F7FA')

    try {
      window.localStorage.setItem('ansem-theme', theme)
    } catch {
      // The selected theme still applies for the current page session.
    }
  }, [theme])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#top" aria-label="$ANSEM Wallet Checker home">
          <TokenLogo />
          <span><strong>$ANSEM</strong><small>WALLET CHECKER</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {nav.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Switch to ${nextTheme} mode`}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme(nextTheme)}
            title={`Switch to ${nextTheme} mode`}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <a className="primary-btn header-check" href="#checker">Check Wallet</a>
          <button
            className="menu-btn"
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation">
          {nav.map(([label, href]) => (
            <a onClick={() => setOpen(false)} key={label} href={href}>{label}</a>
          ))}
          <a className="primary-btn" href="#checker" onClick={() => setOpen(false)}>Check Wallet</a>
        </nav>
      ) : null}
    </header>
  )
}
