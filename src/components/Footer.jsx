import TokenLogo from './TokenLogo'
const nav=['Home','Live Distributions','About','Safety','FAQ']
const hrefs=['#top','#live-distributions','#about','#safety','#faq']
export default function Footer(){return <footer className="footer"><div className="footer-brand"><TokenLogo compact/><div><strong>$ANSEM Wallet Checker</strong><p>Built for transparency<br/>Built for the community</p></div></div><nav aria-label="Footer navigation">{nav.map((n,i)=><a key={n} href={hrefs[i]}>{n}</a>)}</nav><p className="footer-note">Read-only community tool. Verify blockchain information independently.</p></footer>}
