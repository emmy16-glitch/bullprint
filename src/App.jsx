import { useRef, useState } from 'react'
import { findTrackedDistribution, TRACKED_DISTRIBUTION_WALLET, TRACKED_MINT } from './services/solanaRpc'
import './App.css'

const DEMO_ADDRESS = 'HDixbrzwwLXczhDBk1JVrurPQsuLE8FUKnW2pucSXN3o'
const DEMO_AMOUNT = '3,800,000 $ANSEM'
const DEMO_SIGNATURE = '5NdemoBullPrintPreviewRecord1111111111111111111111111111111111'

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
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedWallet = wallet.trim()

    if (isLoading) return

    if (!trimmedWallet) {
      setMessage('Enter a public Solana wallet address to continue.')
      onResult({ status: 'idle' })
      return
    }

    if (!isReasonableSolanaAddress(trimmedWallet)) {
      setMessage('That does not appear to be a valid Solana public address.')
      onResult({ status: 'idle' })
      return
    }

    setIsLoading(true)
    setMessage('Checking Solana…')
    onResult({ status: 'loading' })

    const lookup = await findTrackedDistribution(trimmedWallet)

    if (lookup.error) {
      setMessage(lookup.message)
      onResult({ status: 'error', message: lookup.message })
    } else if (lookup.found) {
      setMessage('Tracked distribution found through live Solana RPC data.')
      onResult({ status: 'found', data: lookup })
    } else {
      setMessage(lookup.reason)
      onResult({ status: 'not-found', message: lookup.reason })
    }

    setIsLoading(false)
  }

  function previewDemo() {
    if (isLoading) return
    setMessage('DEMO RECORD ready. This is sample data, not live verification.')
    onResult({ status: 'demo' })
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
          aria-describedby="walletHelp walletLimitations walletMessage"
          disabled={isLoading}
        />
        <button type="submit" className="primaryButton" disabled={isLoading}>{isLoading ? 'Checking Solana…' : 'Check My BullPrint'}</button>
      </div>
      <div className="formActions">
        <button type="button" className="ghostButton" onClick={previewDemo} disabled={isLoading}>
          Preview Demo Result
        </button>
        <p id="walletHelp">No wallet connection. Public addresses only.</p>
      </div>
      <p className="limitationNote" id="walletLimitations">BullPrint checks a limited set of recent transactions using a public Solana RPC endpoint. No result does not prove that a transfer never occurred.</p>
      <p className="limitationNote">Tracked by BullPrint does not mean officially endorsed.</p>
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
        <p className="clarifier">Paste a public wallet address to check for a configured distribution record using live, read-only Solana Mainnet RPC data.</p>
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

function formatDate(blockTime) {
  if (!blockTime) return 'Unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(blockTime * 1000))
}

function LookupResult({ result }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [cardMessage, setCardMessage] = useState('')
  const receiptRef = useRef(null)

  if (result.status === 'idle' || result.status === 'loading') return null

  const isDemo = result.status === 'demo'
  const data = isDemo ? {
    recipient: DEMO_ADDRESS,
    amountReceived: DEMO_AMOUNT,
    tokenMint: TRACKED_MINT,
    sourceWallet: TRACKED_DISTRIBUTION_WALLET,
    transactionSignature: DEMO_SIGNATURE,
    blockTime: null,
    network: 'Solana Mainnet',
    verification: 'DEMO RECORD',
    explorerUrl: '#tracker',
  } : result.data

  async function copySignature() {
    await navigator.clipboard.writeText(data.transactionSignature)
    setCopyMessage('Transaction signature copied.')
  }

  function generateCard() {
    setCardMessage('BullPrint card preview is shown below. Downloadable image generation will be added in a future iteration.')
    receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (result.status === 'not-found' || result.status === 'error') {
    return (
      <section className={`resultPanel resultPanel--${result.status}`} aria-labelledby="result-title">
        <div className="resultHeader">
          <span className="recordBadge">{result.status === 'error' ? 'Temporary RPC Issue' : 'Not Found'}</span>
          <h2 id="result-title">{result.status === 'error' ? 'Live Lookup Unavailable' : 'No Configured Distribution Found'}</h2>
          <p>{result.message}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="resultPanel" aria-labelledby="result-title">
      <div className="resultHeader">
        <span className="recordBadge">{isDemo ? 'DEMO RECORD' : data.verification}</span>
        <h2 id="result-title">Tracked Distribution Found</h2>
        <p>{isDemo ? 'This is clearly labelled sample data and did not perform a blockchain lookup.' : 'This match was found by checking live, read-only Solana Mainnet RPC data.'}</p>
      </div>
      <dl className="resultGrid">
        <div><dt>Verification</dt><dd>{data.verification}</dd></div>
        <div><dt>Amount received</dt><dd>{data.amountReceived}</dd></div>
        <div><dt>Recipient</dt><dd title={data.recipient}>{shortenAddress(data.recipient)}</dd></div>
        <div><dt>BullPrint tracked distribution wallet</dt><dd title={data.sourceWallet}>{shortenAddress(data.sourceWallet)}</dd></div>
        <div><dt>BullPrint tracked mint</dt><dd title={data.tokenMint}>{shortenAddress(data.tokenMint)}</dd></div>
        <div><dt>Network</dt><dd>{data.network}</dd></div>
        <div><dt>Date</dt><dd>{formatDate(data.blockTime)}</dd></div>
        <div className="wideResult"><dt>Transaction signature</dt><dd title={data.transactionSignature}>{data.transactionSignature}</dd></div>
      </dl>
      <div className="resultActions">
        <a className={`buttonLink ${isDemo ? 'disabledLink' : ''}`} href={data.explorerUrl} target={isDemo ? undefined : '_blank'} rel="noreferrer" aria-disabled={isDemo}>Open in Solana Explorer</a>
        <button type="button" onClick={copySignature}>Copy transaction signature</button>
        <button type="button" className="primaryButton" onClick={generateCard}>Generate BullPrint Card</button>
      </div>
      <div className="statusMessages" aria-live="polite">
        {copyMessage && <p>{copyMessage}</p>}
        {cardMessage && <p>{cardMessage}</p>}
      </div>
      <BullPrintReceipt refProp={receiptRef} result={data} isDemo={isDemo} />
    </section>
  )
}

function BullPrintReceipt({ refProp, result, isDemo }) {
  return (
    <article className="receiptCard" ref={refProp} aria-label="BullPrint receipt card">
      <div className="receiptTop"><BullPrintLogo compact /><span>BULLPRINT / {isDemo ? 'DEMO RECORD' : 'LIVE RPC MATCH'}</span></div>
      <p className="receiptLabel">Tracked Distribution</p>
      <strong>{result.amountReceived}</strong>
      <div className="receiptMeta"><span>Recipient</span><b title={result.recipient}>{shortenAddress(result.recipient)}</b></div>
      <div className="receiptMeta"><span>Network</span><b>{result.network}</b></div>
      <div className="receiptMeta"><span>Status</span><b>{result.verification}</b></div>
      <p className="receiptStory">Every drop has a story.</p>
      <p className="receiptId">{isDemo ? 'BP-DEMO-0001' : result.transactionSignature}</p>
    </article>
  )
}

function HowItWorks() {
  const steps = [
    ['Paste a public address', 'BullPrint never needs access to the wallet.'],
    ['Check tracked transfers', 'BullPrint compares recent public token-account transactions against configured distribution records.'],
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
      <p>Community-built and read-only. BullPrint is not financial advice and does not guarantee token safety.</p>
      <nav aria-label="Footer navigation"><a href="#how-it-works">How It Works</a><a href="#security">Security</a><a href="https://github.com/" rel="noreferrer">GitHub</a></nav>
    </footer>
  )
}

function App() {
  const [result, setResult] = useState({ status: 'idle' })

  return (
    <div className="appShell" id="top">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <Header />
      <main>
        <Hero onResult={setResult} />
        <SecurityNotice />
        <LookupResult result={result} />
        <HowItWorks />
        <SecuritySection />
      </main>
      <Footer />
    </div>
  )
}

export default App
