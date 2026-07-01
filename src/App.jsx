import { useState } from 'react'
import { Icon } from './components/Icons'
import { TokenLogo } from './components/TokenLogo'
import { WalletChecker } from './components/WalletChecker'
import { WalletResult } from './components/WalletResult'
import './App.css'
import './trackerStates.css'

const TOKEN_IMAGE_URL = 'https://images.pump.fun/coin-image/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump?src=https%3A%2F%2Fedge.uxento.io%2Fimage%2FCx83EqERns2VuiKrkwHegTuECVqZebsNhJ3dCU8CucWG&variant=256x256'

function Header() {
  return (
    <header className="siteHeader">
      <a className="brand" href="#top" aria-label="$ANSEM Wallet Checker home">
        <TokenLogo src={TOKEN_IMAGE_URL} />
        <span className="brandText"><strong>$ANSEM</strong><span>Wallet Checker</span></span>
      </a>
      <nav className="headerNav" aria-label="Primary navigation">
        <a href="#about">About</a>
        <a href="#safety">Safety</a>
        <a className="headerAction" href="#checker">Check wallet</a>
      </nav>
    </header>
  )
}

function Introduction() {
  return (
    <section className="introSection" id="about" aria-labelledby="intro-title">
      <div className="introCopy">
        <p className="eyebrow">Community-built · Solana Mainnet</p>
        <h1 id="intro-title">Verify a tracked $ANSEM distribution.</h1>
        <p>Paste a public Solana address to check whether it received a direct transfer from the distribution wallet tracked by this tool.</p>
      </div>
      <div className="introTrust">
        <span><Icon name="shield" /> Read-only lookup</span>
        <span><Icon name="check" /> No wallet connection</span>
        <span><Icon name="check" /> No transaction approval</span>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    ['01', 'Paste a public address', 'Enter the Solana wallet you want to check. Nothing is connected or signed.'],
    ['02', 'Run the tracked lookup', 'The checker compares recent token activity with the configured mint and distribution wallet.'],
    ['03', 'Review the evidence', 'A matching transfer becomes a structured result with transaction evidence and a receipt.'],
  ]

  return (
    <section className="contentSection" id="how-it-works" aria-labelledby="how-title">
      <div className="sectionHeading"><p className="eyebrow">How it works</p><h2 id="how-title">Three steps. No wallet connection.</h2></div>
      <div className="stepsGrid">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
  )
}

function CommunitySection() {
  return (
    <section className="communitySection" aria-labelledby="community-title">
      <div><p className="eyebrow">Community contribution</p><h2 id="community-title">Built to make participation easier to see.</h2></div>
      <div className="communityCopy">
        <p>Communities grow through different kinds of contribution. Content creates attention, culture creates identity, and useful tools create trust.</p>
        <p>This checker turns complicated public transaction data into a result people can understand, verify and share without giving a website control of their wallet.</p>
      </div>
    </section>
  )
}

function SafetySection() {
  return (
    <section className="safetySection" id="safety" aria-labelledby="safety-title">
      <div className="safetyLead"><Icon name="shield" /><div><p className="eyebrow">Safety</p><h2 id="safety-title">Public information only.</h2></div></div>
      <p>This tool never requests a wallet connection, transaction signature, private key or seed phrase. A tracked match is not financial advice, an endorsement, or proof that a token is risk-free.</p>
    </section>
  )
}

function Footer() {
  return (
    <footer className="siteFooter">
      <div className="footerBrand"><TokenLogo src={TOKEN_IMAGE_URL} /><span><strong>$ANSEM Wallet Checker</strong><small>Community-built on Solana.</small></span></div>
      <nav aria-label="Footer navigation"><a href="#about">About</a><a href="#checker">Checker</a><a href="#safety">Safety</a></nav>
      <p>Read-only community tool. Verify blockchain information independently.</p>
    </footer>
  )
}

function App() {
  const [result, setResult] = useState({ status: 'idle' })

  return (
    <div className="appShell" id="top">
      <div className="backgroundGrid" />
      <Header />
      <main>
        <Introduction />
        <WalletChecker onResult={setResult} />
        <WalletResult result={result} logoSrc={TOKEN_IMAGE_URL} />
        <HowItWorks />
        <CommunitySection />
        <SafetySection />
      </main>
      <Footer />
    </div>
  )
}

export default App
