import { useRef, useState } from 'react'
import { findTrackedDistribution } from './services/solanaRpc'
import './App.css'
import './trackerStates.css'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

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

function decodedBase58Length(value) {
  const bytes = [0]

  for (const character of value) {
    const characterValue = BASE58_ALPHABET.indexOf(character)
    if (characterValue < 0) return 0

    let carry = characterValue
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58
      bytes[index] = carry & 0xff
      carry >>= 8
    }

    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  for (let index = 0; value[index] === '1' && index < value.length - 1; index += 1) {
    bytes.push(0)
  }

  return bytes.length
}

function isValidSolanaAddress(value) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false
  return decodedBase58Length(value) === 32
}

function LoadingSpinner({ small = false }) {
  return <span className={`loadingSpinner ${small ? 'loadingSpinner--small' : ''}`} aria-hidden="true" />
}

function WalletSearchForm({ onResult }) {
  const [wallet, setWallet] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function showMessage(text, type) {
    setMessage(text)
    setMessageType(type)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedWallet = wallet.trim()

    if (isLoading) return

    if (!trimmedWallet) {
      showMessage('Enter a public Solana wallet address to continue.', 'validation')
      onResult({ status: 'idle' })
      return
    }

    if (!isValidSolanaAddress(trimmedWallet)) {
      showMessage('Enter a complete Solana address. It must use Base58 characters and decode to exactly 32 bytes.', 'validation')
      onResult({ status: 'idle' })
      return
    }

    setWallet(trimmedWallet)
    setIsLoading(true)
    showMessage('Checking live Solana Mainnet data…', 'loading')
    onResult({ status: 'loading' })

    try {
      const lookup = await findTrackedDistribution(trimmedWallet)

      if (lookup.error) {
        showMessage(lookup.message, 'error')
        onResult({ status: 'error', message: lookup.message })
      } else if (lookup.found) {
        showMessage('Tracked distribution found through live Solana RPC data.', 'found')
        onResult({ status: 'found', data: lookup })
      } else {
        showMessage(lookup.reason, 'not-found')
        onResult({ status: 'not-found', message: lookup.reason })
      }
    } catch {
      const fallbackMessage = 'BullPrint could not complete the live lookup. Please try again shortly.'
      showMessage(fallbackMessage, 'error')
      onResult({ status: 'error', message: fallbackMessage })
    } finally {
      setIsLoading(false)
    }
  }

  function handleWalletChange(event) {
    setWallet(event.target.value)

    if (messageType === 'validation') {
      setMessage('')
      setMessageType('')
    }
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
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          inputMode="text"
          placeholder="Paste public address only"
          value={wallet}
          onChange={handleWalletChange}
          aria-describedby="walletHelp walletLimitations walletMessage"
          aria-invalid={messageType === 'validation'}
          className={messageType === 'validation' ? 'inputError' : ''}
          disabled={isLoading}
        />
        <button type="submit" className="primaryButton" disabled={isLoading}>
          <span className="buttonContent">
            {isLoading && <LoadingSpinner small />}
            {isLoading ? 'Checking Solana…' : 'Check My BullPrint'}
          </span>
        </button>
      </div>
      <p className="walletHelp" id="walletHelp">No wallet connection. Public addresses only.</p>
      <p className="limitationNote" id="walletLimitations">BullPrint checks a limited set of recent transactions using live Solana Mainnet RPC data. No result does not prove that a transfer never occurred.</p>
      <p className="limitationNote">Tracked by BullPrint does not mean officially endorsed.</p>
      {message && (
        <p className={`formMessage formMessage--${messageType}`} id="walletMessage" role="status" aria-live="polite">
          {messageType === 'loading' && <LoadingSpinner small />}
          <span>{message}</span>
        </p>
      )}
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

function ResultStatusIcon({ status }) {
  if (status === 'loading') return <LoadingSpinner />

  const path = status === 'found'
    ? 'M5 12.5 10 17 19 7'
    : status === 'not-found'
      ? 'M8 8l8 8M16 8l-8 8'
      : 'M12 7v6M12 17h.01'

  return (
    <span className={`resultStatusIcon resultStatusIcon--${status}`} aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d={path} /></svg>
    </span>
  )
}

function LookupResult({ result }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [cardMessage, setCardMessage] = useState('')
  const receiptRef = useRef(null)

  if (result.status === 'idle') return null

  if (result.status === 'loading') {
    return (
      <section className="resultPanel resultPanel--loading" aria-live="polite" aria-label="Lookup in progress">
        <div className="resultStatusLayout">
          <ResultStatusIcon status="loading" />
          <div className="resultHeader">
            <span className="recordBadge">Live lookup</span>
            <h2>Checking the blockchain</h2>
            <p>BullPrint is checking token accounts and recent confirmed transactions. This may take a few seconds.</p>
          </div>
        </div>
      </section>
    )
  }

  if (result.status === 'not-found' || result.status === 'error') {
    const isError = result.status === 'error'

    return (
      <section className={`resultPanel resultPanel--${result.status}`} aria-labelledby="result-title" aria-live="polite">
        <div className="resultStatusLayout">
          <ResultStatusIcon status={result.status} />
          <div className="resultHeader">
            <span className="recordBadge">{isError ? 'Lookup issue' : 'No match'}</span>
            <h2 id="result-title">{isError ? 'Live Lookup Unavailable' : 'No Tracked Distribution Found'}</h2>
            <p>{result.message}</p>
            {!isError && <p className="resultHint">The lookup completed successfully. This result only covers BullPrint’s configured mint and limited recent transaction search.</p>}
          </div>
        </div>
      </section>
    )
  }

  const data = result.data

  async function copySignature() {
    try {
      await navigator.clipboard.writeText(data.transactionSignature)
      setCopyMessage('Transaction signature copied.')
    } catch {
      setCopyMessage('Copy failed. Press and hold the signature to copy it manually.')
    }
  }

  function generateCard() {
    setCardMessage('BullPrint card preview is shown below. Downloadable image generation will be added in a future iteration.')
    receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section className="resultPanel resultPanel--found" aria-labelledby="result-title" aria-live="polite">
      <div className="resultStatusLayout">
        <ResultStatusIcon status="found" />
        <div className="resultHeader">
          <span className="recordBadge">Verified match</span>
          <h2 id="result-title">Tracked Distribution Found</h2>
          <p>This match was found by checking live, read-only Solana Mainnet RPC data.</p>
        </div>
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
        <a className="buttonLink" href={data.explorerUrl} target="_blank" rel="noreferrer">Open in Solana Explorer</a>
        <button type="button" onClick={copySignature}>Copy transaction signature</button>
        <button type="button" className="primaryButton" onClick={generateCard}>Generate BullPrint Card</button>
      </div>
      <div className="statusMessages" aria-live="polite">
        {copyMessage && <p>{copyMessage}</p>}
        {cardMessage && <p>{cardMessage}</p>}
      </div>
      <BullPrintReceipt refProp={receiptRef} result={data} />
    </section>
  )
}

function BullPrintReceipt({ refProp, result }) {
  return (
    <article className="receiptCard" ref={refProp} aria-label="BullPrint receipt card">
      <div className="receiptTop"><BullPrintLogo compact /><span>BULLPRINT / LIVE RPC MATCH</span></div>
      <p className="receiptLabel">Tracked Distribution</p>
      <strong>{result.amountReceived}</strong>
      <div className="receiptMeta"><span>Recipient</span><b title={result.recipient}>{shortenAddress(result.recipient)}</b></div>
      <div className="receiptMeta"><span>Network</span><b>{result.network}</b></div>
      <div className="receiptMeta"><span>Status</span><b>{result.verification}</b></div>
      <p className="receiptStory">Every drop has a story.</p>
      <p className="receiptId">{result.transactionSignature}</p>
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
      <nav aria-label="Footer navigation"><a href="#how-it-works">How It Works</a><a href="#security">Security</a><a href="https://github.com/emmy16-glitch/bullprint" target="_blank" rel="noreferrer">GitHub</a></nav>
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
