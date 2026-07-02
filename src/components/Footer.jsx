import TokenLogo from './TokenLogo'

const nav = [
  ['Home', '#top'],
  ['Live Distributions', '#live-distributions'],
  ['About', '#about'],
  ['Safety', '#safety'],
  ['FAQ', '#faq'],
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <TokenLogo compact />
        <div>
          <strong>$ANSEM Wallet Checker</strong>
          <p>Built for transparency<br />Built for the community</p>
        </div>
      </div>
      <nav aria-label="Footer navigation">
        {nav.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
      </nav>
      <div className="footer-note">
        <p>Read-only community tool. Verify blockchain information independently.</p>
        <div className="social-links" aria-label="Community and project links">
          <a href="https://x.com/blknoiz06" target="_blank" rel="noreferrer">X / @blknoiz06 ↗</a>
          <a href="https://github.com/emmy16-glitch/bullprint" target="_blank" rel="noreferrer">Source code ↗</a>
        </div>
        <small>Only confirmed public links are listed.</small>
      </div>
    </footer>
  )
}
