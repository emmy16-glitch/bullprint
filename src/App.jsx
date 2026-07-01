import { useRef, useState } from 'react'
import './App.css'

const DEMO_ADDRESS = 'HDixbrzwwLXczhDBk1JVrurPQsuLE8FUKnW2pucSXN3o'
const DEMO_AMOUNT = '3,800,000 $ANSEM'

function BullPrintLogo({ compact = false }) {
  return (
    <span className={`logoMark ${compact ? 'logoMark--compact' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="presentation" focusable="false">
        <path className="horn horn--left" d="M8 17c9 1 14 6 17 14" />
        <path className="horn horn--right" d="M56 17c-9 1-14 6-17 14" />
        <path className="face" d="M19 29c3-8 9-12 13-12s10 4 13 12c2 6-1 15-13 20C20 44 17 35 19 29Z" />
        <path className="print" d="M25 31c2-5 12-5 14 0" />
        <path className="print" d="M24 37c4-6 12-6 16 0" />
        <path className="print" d="M27 43c3-3 7-3 10 0" />
        <circle className="eye" cx="26" cy="30" r="1.7" />
        <circle className="eye" cx="38" cy="30" r="1.7" />
      </svg>
    </span>
  )
}

function Header() {
  return (
    <header className="siteHeader">
      <a className="brand" href="#top" aria-label="BullPrint home">
        <BullPrintLogo />
        <span>BullPrint</span>
      </a>
      <nav className="headerNav" aria-label="Primary navigation">
        <a href="#how-it-works">How It Works</a>
        <a href="#security">Security</a>
        <a className="navButton" href="#tracker">Track a Drop</a>
      </nav>
    </header>
  )
}

function shortenAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

function isReasonableSolanaAddress(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
}

function WalletSearchForm({ onResult }) {
  const [wallet, setWallet] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const trimmedWallet = wallet.trim()

    if (!trimmedWallet) {
      setMessage('Enter a public Solana wallet address to continue.')
      onResult('none')
      return
    }

    if (!isReasonableSolanaAddress(trimmedWallet)) {
      setMessage('That does not appear to be a valid Solana public address.')
      onResult('none')
      return
    }

    if (trimmedWallet === DEMO_ADDRESS) {
      setMessage('Demo record ready. This is sample data, not a live blockchain result.')
      onResult('demo')
      return
    }

    // Future live Solana lookup will connect here after the read-only API layer is implemented.
    setMessage('No tracked distribution was found in this demonstration. Live Solana lookup will be added in the next version.')
    onResult('none')
  }

  return (
    <form className="walletForm" id="tracker" onSubmit={handleSubmit} noValidate>
      <label htmlFor="walletAddress">Public Solana wallet address</label>
      <div className="inputRow">
        <input
          id="walletAddress"
          name="walletAddress"
          type="text"
          autoComplete="off"
          inputMode="text"
          placeholder="Paste public address only"
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          aria-describedby="walletHelp walletMessage"
        />
        <button type="submit" className="primaryButton">Check My BullPrint</button>
      </div>
      <div className="formActions">
        <button type="button" className="ghostButton" onClick={() => setWallet(DEMO_ADDRESS)}>
          Try Demo Address
        </button>
        <p id="walletHelp">No wallet connection. Public addresses only.</p>
      </div>
      {message && <p className="formMessage" id="walletMessage" role="status">{message}</p>}
    </form>
  )
}

function Hero({ onResult }) {
  return (
    <section className="heroSection" aria-labelledby="hero-title">
      <div className="heroCopy">
        <p className="eyebrow">Read-only Solana distribution tracker</p>
        <h1 id="hero-title">Every drop has a story.</h1>
        <p className="lead">BullPrint turns tracked $ANSEM distributions into clear, shareable on-chain receipts using public wallet information.</p>
        <p className="clarifier">Live Solana verification is coming next. The current version demonstrates the BullPrint experience using sample data.</p>
      </div>
      <WalletSearchForm onResult={onResult} />
    </section>
  )
}

function SecurityNotice() {
  const items = ['No wallet connection', 'No private key', 'No seed phrase', 'No transaction approval']
  return (
    <aside className="securityStrip" aria-label="Security notice">
      {items.map((item) => (
        <span className="securityPill" key={item}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>
          {item}
        </span>
      ))}
      <p>BullPrint only uses public blockchain information. Never enter your seed phrase or private key into any website.</p>
    </aside>
  )
}

function DemoResult({ visible }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [transactionMessage, setTransactionMessage] = useState('')
  const [cardMessage, setCardMessage] = useState('')
  const receiptRef = useRef(null)

  async function copyRecipient() {
    await navigator.clipboard.writeText(DEMO_ADDRESS)
    setCopyMessage('Recipient copied.')
  }

  function revealReceipt() {
    setCardMessage('Downloadable image generation will be added in the next iteration.')
    receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!visible) return null

  return (
    <section className="resultPanel" aria-labelledby="result-title">
      <div className="resultHeader">
        <span className="recordBadge">Demo Record</span>
        <h2 id="result-title">Tracked Distribution Found</h2>
        <p>This premium panel uses clearly labelled sample data for the frontend prototype.</p>
      </div>
      <dl className="resultGrid">
        <div><dt>Recipient</dt><dd title={DEMO_ADDRESS}>{shortenAddress(DEMO_ADDRESS)}</dd></div>
        <div><dt>Amount</dt><dd>{DEMO_AMOUNT}</dd></div>
        <div><dt>Source</dt><dd>Tracked Distribution Wallet</dd></div>
        <div><dt>Network</dt><dd>Solana</dd></div>
        <div><dt>Record type</dt><dd>Community Distribution</dd></div>
        <div><dt>Verification</dt><dd>Sample Data</dd></div>
      </dl>
      <div className="resultActions">
        <button type="button" onClick={copyRecipient}>Copy Recipient</button>
        <button type="button" onClick={() => setTransactionMessage('Transaction explorer linking will become available after live verification is connected.')}>View Demo Transaction</button>
        <button type="button" className="primaryButton" onClick={revealReceipt}>Generate BullPrint Card</button>
      </div>
      <div className="statusMessages" aria-live="polite">
        {copyMessage && <p>{copyMessage}</p>}
        {transactionMessage && <p>{transactionMessage}</p>}
        {cardMessage && <p>{cardMessage}</p>}
      </div>
      <BullPrintReceipt refProp={receiptRef} />
    </section>
  )
}

function BullPrintReceipt({ refProp }) {
  return (
    <article className="receiptCard" ref={refProp} aria-label="BullPrint demo receipt card">
      <div className="receiptTop"><BullPrintLogo compact /><span>BULLPRINT / DEMO RECORD</span></div>
      <p className="receiptLabel">Tracked Distribution</p>
      <strong>{DEMO_AMOUNT}</strong>
      <div className="receiptMeta"><span>Recipient</span><b title={DEMO_ADDRESS}>{shortenAddress(DEMO_ADDRESS)}</b></div>
      <div className="receiptMeta"><span>Network</span><b>Solana</b></div>
      <div className="receiptMeta"><span>Status</span><b>Sample Data</b></div>
      <p className="receiptStory">Every drop has a story.</p>
      <p className="receiptId">BP-DEMO-0001</p>
    </article>
  )
}

function HowItWorks() {
  const steps = [
    ['Paste a public address', 'BullPrint never needs access to the wallet.'],
    ['Check tracked transfers', 'The live version will compare public Solana transfers against configured distribution records.'],
    ['Share the story', 'Generate a clear receipt that documents the distribution.'],
  ]
  return (
    <section className="infoSection" id="how-it-works" aria-labelledby="how-title">
      <p className="eyebrow">How BullPrint Works</p>
      <h2 id="how-title">A simple read-only receipt flow.</h2>
      <div className="steps">{steps.map(([title, text], index) => <article className="stepCard" key={title}><span>{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
  )
}

function SecuritySection() {
  return (
    <section className="infoSection securitySection" id="security" aria-labelledby="security-title">
      <p className="eyebrow">Security</p>
      <h2 id="security-title">Careful by design, never a guarantee of safety.</h2>
      <ul>
        <li>BullPrint is read-only.</li>
        <li>BullPrint will never request a seed phrase, private key or transaction approval.</li>
        <li>A tracked transfer does not guarantee that a token or website is safe.</li>
        <li>Users should independently verify blockchain information.</li>
      </ul>
    </section>
  )
}

function Footer() {
  return (
    <footer className="siteFooter">
      <div><BullPrintLogo compact /><strong>BullPrint</strong><p>Built for the $ANSEM community.</p></div>
      <p>Community-built, read-only and currently using demonstration data. BullPrint is not financial advice and does not guarantee token safety.</p>
      <nav aria-label="Footer navigation"><a href="#how-it-works">How It Works</a><a href="#security">Security</a><a href="https://github.com/" rel="noreferrer">GitHub</a></nav>
    </footer>
  )
}

function App() {
  const [result, setResult] = useState('none')

  return (
    <div className="appShell" id="top">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <Header />
      <main>
        <Hero onResult={setResult} />
        <SecurityNotice />
        <DemoResult visible={result === 'demo'} />
        <HowItWorks />
        <SecuritySection />
      </main>
      <Footer />
    </div>
  )
}

export default App
