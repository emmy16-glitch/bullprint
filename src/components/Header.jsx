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
  const [activeHref, setActiveHref] = useState('#top')

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

  useEffect(() => {
    function updateActiveSection() {
      const marker = window.scrollY + Math.min(180, window.innerHeight * 0.35)
      let current = '#top'

      for (const [, href] of nav) {
        const section = document.querySelector(href)
        if (section && section.offsetTop <= marker) current = href
      }

      setActiveHref(current)
    }

    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)
    window.addEventListener('hashchange', updateActiveSection)

    return () => {
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
      window.removeEventListener('hashchange', updateActiveSection)
    }
  }, [])

  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  function navLink(label, href, closeMenu = false) {
    const active = activeHref === href
    return (
      <a
        key={label}
        href={href}
        className={active ? 'is-active' : undefined}
        aria-current={active ? 'location' : undefined}
        onClick={() => {
          setActiveHref(href)
          if (closeMenu) setOpen(false)
        }}
      >
        {label}
      </a>
    )
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <a
          className="brand"
          href="#top"
          aria-label="$ANSEM Wallet Checker home"
          onClick={() => setActiveHref('#top')}
        >
          <TokenLogo />
          <span><strong>$ANSEM</strong><small>WALLET CHECKER</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {nav.map(([label, href]) => navLink(label, href))}
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
            <span>Use {nextTheme}</span>
          </button>
          <a className="primary-btn header-check" href="#checker">Check Wallet</a>
          <button
            className="menu-btn"
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={`${open ? 'Close' : 'Open'} navigation menu`}
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation">
          {nav.map(([label, href]) => navLink(label, href, true))}
          <a className="primary-btn" href="#checker" onClick={() => setOpen(false)}>Check Wallet</a>
        </nav>
      ) : null}
    </header>
  )
}
