import { useRef, useState } from 'react'
import { findTrackedDistribution, TRACKED_DISTRIBUTION_WALLET, TRACKED_MINT } from './services/solanaRpc'
import './App.css'
import './trackerStates.css'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const TOKEN_IMAGE_URL = 'https://images.pump.fun/coin-image/9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump?src=https%3A%2F%2Fedge.uxento.io%2Fimage%2FCx83EqERns2VuiKrkwHegTuECVqZebsNhJ3dCU8CucWG&variant=256x256'

function TokenLogo({ large = false }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <span className={`tokenLogo ${large ? 'tokenLogo--large' : ''}`} aria-hidden="true">
      {imageFailed ? (
        <span className="tokenLogoFallback">$A</span>
      ) : (
        <img src={TOKEN_IMAGE_URL} alt="" onError={() => setImageFailed(true)} />
      )}
    </span>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  )
}

function Header() {
  return (
    <header className="siteHeader">
      <a className="brand" href="#top" aria-label="$ANSEM Wallet Checker home">
        <TokenLogo />
        <span className="brandCopy">
          <strong>$ANSEM</strong>
          <small>Wallet Checker</small>
        </span>
      </a>

      <nav className="headerNav" aria-label="Primary navigation">
        <a href="#checker">Checker</a>
        <a href="#how-it-works">How it works</a>
        <a href="#community">Community</a>
        <a className="navButton" href="#checker">Check a wallet</a>
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

function TrustPill({ children }) {
  return (
    <span className="trustPill">
      <CheckIcon />
      {children}
    </span>
  )
}

function Hero() {
  return (
    <section className="heroSection" aria-labelledby="hero-title">
      <div className="heroCopy">
        <p className="eyebrow">Community-built · Read-only · Solana Mainnet</p>
        <h1 id="hero-title">Check the chain. <span>Know the story.</span></h1>
        <p className="lead">
          Verify whether a public wallet received a tracked $ANSEM distribution—without connecting a wallet or approving a transaction.
        </p>

        <div className="heroActions">
          <a className="primaryLink" href="#checker">
            Check a wallet
            <ArrowIcon />
          </a>
          <a className="secondaryLink" href="#how-it-works">See how it works</a>
        </div>

        <div className="trustRow" aria-label="Security highlights">
          <TrustPill>No wallet connection</TrustPill>
          <TrustPill>No private key</TrustPill>
          <TrustPill>Live RPC data</TrustPill>
        </div>
      </div>

      <div className="heroVisual" aria-label="$ANSEM token visual">
        <div className="orbit orbitOne" />
        <div className="orbit orbitTwo" />
        <div className="heroCoin">
          <TokenLogo large />
          <div className="heroCoinText">
            <span>TRACKED TOKEN</span>
            <strong>$ANSEM</strong>
            <small>THE BLACK BULL</small>
          </div>
        </div>
        <div className="floatingCard floatingCard--top">
          <span className="statusDot" />
          Live on Solana
        </div>
        <div className="floatingCard floatingCard--bottom">
          <ShieldIcon />
          Read-only verification
        </div>
      </div>
    </section>
  )
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
      showMessage('Paste a public Solana wallet address to continue.', 'validation')
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
        setMessage('')
        setMessageType('')
        onResult({ status: 'error', message: lookup.message })
      } else if (lookup.found) {
        setMessage('')
        setMessageType('')
        onResult({ status: 'found', data: lookup })
      } else {
        setMessage('')
        setMessageType('')
        onResult({ status: 'not-found', message: lookup.reason })
      }
    } catch {
      const fallbackMessage = 'The live lookup could not be completed. Please try again shortly.'
      setMessage('')
      setMessageType('')
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
    <form className="walletForm" onSubmit={handleSubmit} noValidate>
      <div className="formHeading">
        <div>
          <span className="sectionKicker">Public address only</span>
          <h3>Enter a Solana wallet</h3>
        </div>
        <span className="networkBadge"><span className="statusDot" /> Mainnet</span>
      </div>

      <label htmlFor="walletAddress">Wallet address</label>
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
          placeholder="Paste a Solana wallet address"
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
            {isLoading ? 'Checking…' : 'Check Wallet'}
          </span>
        </button>
      </div>

      <p className="walletHelp" id="walletHelp">
        The checker never requests a wallet connection, signature, private key or seed phrase.
      </p>
      <p className="limitationNote" id="walletLimitations">
        Results cover the configured mint and a limited set of recent confirmed transactions. No match does not prove that a transfer never occurred.
      </p>

      {message && (
        <p className={`formMessage formMessage--${messageType}`} id="walletMessage" role="status" aria-live="polite">
          {messageType === 'loading' && <LoadingSpinner small />}
          <span>{message}</span>
        </p>
      )}
    </form>
  )
}

function CheckerSection({ onResult }) {
  return (
    <section className="checkerSection" id="checker" aria-labelledby="checker-title">
      <div className="sectionHeading sectionHeading--center">
        <p className="eyebrow">$ANSEM Wallet Checker</p>
        <h2 id="checker-title">One address. One clear answer.</h2>
        <p>Paste a public wallet address and check it against the distribution wallet and mint configured by this community tool.</p>
      </div>
      <WalletSearchForm onResult={onResult} />
    </section>
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
            <p>Looking through token accounts and recent confirmed transactions. This can take a few seconds.</p>
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
            <h2 id="result-title">{isError ? 'Live lookup unavailable' : 'No tracked distribution found'}</h2>
            <p>{result.message}</p>
            {!isError && <p className="resultHint">The lookup completed successfully. This result is limited to the configured $ANSEM mint and recent transaction search.</p>}
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
    setCardMessage('Your $ANSEM receipt is shown below. Downloadable image export can be added next.')
    receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section className="resultPanel resultPanel--found" aria-labelledby="result-title" aria-live="polite">
      <div className="resultStatusLayout">
        <ResultStatusIcon status="found" />
        <div className="resultHeader">
          <span className="recordBadge">On-chain match</span>
          <h2 id="result-title">$ANSEM distribution verified</h2>
          <p>A matching transfer was found using live, read-only Solana Mainnet RPC data.</p>
        </div>
      </div>

      <div className="amountSpotlight">
        <span>Amount received</span>
        <strong>{data.amountReceived} <small>$ANSEM</small></strong>
      </div>

      <dl className="resultGrid">
        <div><dt>Verification</dt><dd>{data.verification}</dd></div>
        <div><dt>Recipient</dt><dd title={data.recipient}>{shortenAddress(data.recipient)}</dd></div>
        <div><dt>Distribution wallet</dt><dd title={data.sourceWallet}>{shortenAddress(data.sourceWallet)}</dd></div>
        <div><dt>Tracked mint</dt><dd title={data.tokenMint}>{shortenAddress(data.tokenMint)}</dd></div>
        <div><dt>Network</dt><dd>{data.network}</dd></div>
        <div><dt>Date</dt><dd>{formatDate(data.blockTime)}</dd></div>
        <div className="wideResult"><dt>Transaction signature</dt><dd title={data.transactionSignature}>{data.transactionSignature}</dd></div>
      </dl>

      <div className="resultActions">
        <a className="buttonLink" href={data.explorerUrl} target="_blank" rel="noreferrer">Open in Solana Explorer</a>
        <button type="button" onClick={copySignature}>Copy signature</button>
        <button type="button" className="primaryButton" onClick={generateCard}>Generate $ANSEM Receipt</button>
      </div>

      <div className="statusMessages" aria-live="polite">
        {copyMessage && <p>{copyMessage}</p>}
        {cardMessage && <p>{cardMessage}</p>}
      </div>

      <AnsemReceipt refProp={receiptRef} result={data} />
    </section>
  )
}

function AnsemReceipt({ refProp, result }) {
  return (
    <article className="receiptCard" ref={refProp} aria-label="$ANSEM distribution receipt">
      <div className="receiptTop">
        <div className="receiptBrand"><TokenLogo /><span>$ANSEM RECEIPT</span></div>
        <span className="receiptStatus"><span className="statusDot" /> LIVE MATCH</span>
      </div>
      <p className="receiptLabel">Tracked distribution</p>
      <strong>{result.amountReceived} <small>$ANSEM</small></strong>
      <div className="receiptMeta"><span>Recipient</span><b title={result.recipient}>{shortenAddress(result.recipient)}</b></div>
      <div className="receiptMeta"><span>Network</span><b>{result.network}</b></div>
      <div className="receiptMeta"><span>Date</span><b>{formatDate(result.blockTime)}</b></div>
      <p className="receiptStory">Community contribution, documented on-chain.</p>
      <p className="receiptId">{result.transactionSignature}</p>
    </article>
  )
}

function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Paste a public address',
      text: 'Use the public Solana address you want to check. Nothing is connected or signed.',
    },
    {
      number: '02',
      title: 'Check tracked transfers',
      text: 'The tool compares recent token-account activity with the configured mint and distribution wallet.',
    },
    {
      number: '03',
      title: 'Read the receipt',
      text: 'A matching transfer becomes a clear receipt with the amount, date and transaction signature.',
    },
  ]

  return (
    <section className="infoSection" id="how-it-works" aria-labelledby="how-title">
      <div className="sectionHeading">
        <p className="eyebrow">How it works</p>
        <h2 id="how-title">On-chain proof without the usual complexity.</h2>
      </div>
      <div className="steps">
        {steps.map((step) => (
          <article className="stepCard" key={step.number}>
            <span>{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function CommunitySection() {
  return (
    <section className="communitySection" id="community" aria-labelledby="community-title">
      <div className="communityStatement">
        <p className="eyebrow">Built as a contribution</p>
        <h2 id="community-title">Some people create content. Some people build the tools behind it.</h2>
        <p>
          Communities grow through more than price talk. Videos create attention, memes create culture, and useful products create trust. This checker is one small piece of infrastructure for making tracked distributions easier to verify, explain and share.
        </p>
        <p>
          The goal is not to promise rewards. It is to help the community document real participation with public on-chain evidence.
        </p>
      </div>

      <div className="communityCards">
        <article>
          <span>01</span>
          <h3>Make participation visible</h3>
          <p>Turn complicated transaction history into a receipt people can understand.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Give campaigns context</h3>
          <p>Help community distributions carry a clear, verifiable story.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Build before asking</h3>
          <p>Contribute something useful instead of waiting for the community to do everything.</p>
        </article>
      </div>
    </section>
  )
}

function SafetySection() {
  const items = [
    ['No wallet connection', 'The checker only accepts a public address.'],
    ['No secret information', 'Never enter a seed phrase or private key.'],
    ['No transaction approval', 'The tool cannot move funds or request a signature.'],
    ['No endorsement claim', 'A tracked result does not prove a token or project is safe.'],
  ]

  return (
    <section className="safetySection" id="safety" aria-labelledby="safety-title">
      <div className="sectionHeading sectionHeading--center">
        <p className="eyebrow">Safety by design</p>
        <h2 id="safety-title">Read-only means read-only.</h2>
        <p>The checker works with public blockchain information and does not need control of anyone’s wallet.</p>
      </div>
      <div className="safetyGrid">
        {items.map(([title, text]) => (
          <article key={title}>
            <ShieldIcon />
            <div><h3>{title}</h3><p>{text}</p></div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="siteFooter">
      <div className="footerBrand">
        <TokenLogo />
        <div><strong>$ANSEM Wallet Checker</strong><p>Community-built on Solana.</p></div>
      </div>
      <p className="footerDisclaimer">
        This is a read-only community tool and is not financial advice or an official endorsement. The displayed token image is loaded from the tracked Pump listing.
      </p>
      <nav aria-label="Footer navigation">
        <a href="#checker">Checker</a>
        <a href="#community">Community</a>
        <a href="https://github.com/emmy16-glitch/bullprint" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </footer>
  )
}

function App() {
  const [result, setResult] = useState({ status: 'idle' })

  return (
    <div className="appShell" id="top">
      <div className="backgroundGrid" />
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <Header />
      <main>
        <Hero />
        <CheckerSection onResult={setResult} />
        <LookupResult result={result} />
        <HowItWorks />
        <CommunitySection />
        <SafetySection />
      </main>
      <Footer />
    </div>
  )
}

export { TRACKED_DISTRIBUTION_WALLET, TRACKED_MINT }
export default App
