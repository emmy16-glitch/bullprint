import { useEffect, useRef, useState } from 'react'
import { formatDate, shortenAddress } from '../utils/solanaAddress'
import { Icon } from './Icons'
import { LoadingSpinner } from './WalletChecker'
import { TokenLogo } from './TokenLogo'

async function copyText(value) {
  if (!navigator.clipboard) throw new Error('Clipboard unavailable')
  await navigator.clipboard.writeText(value)
}

function StatusBanner({ status, message }) {
  const states = {
    loading: ['Live lookup', 'Checking Solana Mainnet', 'The checker is validating token accounts and recent confirmed transactions.'],
    found: ['Verified match', '$ANSEM distribution found', 'A direct transfer matching the tracked mint and distribution wallet was found.'],
    'not-found': ['Completed lookup', 'No tracked distribution found', message],
    error: ['RPC issue', 'Live lookup unavailable', message],
  }
  const [label, title, text] = states[status]
  const icon = status === 'loading' ? <LoadingSpinner /> : <Icon name={status === 'found' ? 'check' : status === 'not-found' ? 'close' : 'alert'} />

  return (
    <div className={`statusBanner statusBanner--${status}`}>
      <div className="statusIcon">{icon}</div>
      <div><span>{label}</span><h3>{title}</h3><p>{text}</p></div>
    </div>
  )
}

function Overview({ data }) {
  return (
    <div className="overviewLayout">
      <article className="amountCard"><span>Amount received</span><strong>{data.amountReceived}</strong><small>$ANSEM</small></article>
      <div className="overviewCards">
        <article><span>Network</span><strong>{data.network}</strong></article>
        <article><span>Date received</span><strong>{formatDate(data.blockTime)}</strong></article>
        <article><span>Verification</span><strong>{data.verification}</strong></article>
        <article><span>Transaction</span><strong>{shortenAddress(data.transactionSignature, 8, 8)}</strong></article>
      </div>
    </div>
  )
}

function EvidenceRow({ label, value, link }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await copyText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="evidenceRow">
      <span>{label}</span>
      <div><code title={value}>{value}</code><button type="button" onClick={handleCopy}><Icon name="copy" />{copied ? 'Copied' : 'Copy'}</button>{link ? <a href={link} target="_blank" rel="noreferrer"><Icon name="external" />Open</a> : null}</div>
    </div>
  )
}

function Evidence({ data }) {
  return (
    <div className="evidencePanel">
      <EvidenceRow label="Recipient" value={data.recipient} />
      <EvidenceRow label="Distribution wallet" value={data.sourceWallet} />
      <EvidenceRow label="Tracked mint" value={data.tokenMint} />
      <EvidenceRow label="Transaction signature" value={data.transactionSignature} link={data.explorerUrl} />
      <div className="evidenceRow"><span>Block time</span><div><code>{formatDate(data.blockTime)}</code></div></div>
    </div>
  )
}

function SafetyEvidence() {
  const items = [
    ['Read-only', 'The checker only reads public Solana data.'],
    ['No wallet connection', 'It does not request wallet access.'],
    ['No secret information', 'Never enter secret wallet recovery information.'],
    ['Limited result', 'No match does not prove a transfer never occurred outside the search range.'],
  ]
  return <div className="resultSafetyGrid">{items.map(([title, text]) => <article key={title}><Icon name="shield" /><div><strong>{title}</strong><p>{text}</p></div></article>)}</div>
}

function Receipt({ data, receiptRef, logoSrc }) {
  return (
    <article className="receiptCard" ref={receiptRef}>
      <div className="receiptHeader"><div><TokenLogo src={logoSrc} /><strong>$ANSEM Receipt</strong></div><span><i /> Live match</span></div>
      <p>Tracked distribution</p>
      <h3>{data.amountReceived} <small>$ANSEM</small></h3>
      <dl><div><dt>Recipient</dt><dd>{shortenAddress(data.recipient, 8, 8)}</dd></div><div><dt>Date</dt><dd>{formatDate(data.blockTime)}</dd></div><div><dt>Network</dt><dd>{data.network}</dd></div></dl>
      <footer>{shortenAddress(data.transactionSignature, 12, 12)}</footer>
    </article>
  )
}

export function WalletResult({ result, logoSrc }) {
  const [tab, setTab] = useState('overview')
  const [copyMessage, setCopyMessage] = useState('')
  const receiptRef = useRef(null)

  useEffect(() => {
    setTab('overview')
    setCopyMessage('')
  }, [result.status, result.wallet])

  if (result.status === 'idle') return null

  async function copyAddress() {
    try {
      await copyText(result.wallet)
      setCopyMessage('Wallet address copied.')
    } catch {
      setCopyMessage('Press and hold the address to copy it manually.')
    }
  }

  const statusLabel = result.status === 'found' ? 'Match found' : result.status === 'not-found' ? 'No match' : result.status === 'error' ? 'Lookup issue' : 'Checking'
  const explorer = `https://explorer.solana.com/address/${result.wallet}`

  return (
    <section className="resultSection">
      <div className="walletHeader">
        <div className="walletIdentity"><TokenLogo src={logoSrc} /><div><span>Wallet</span><h2>{shortenAddress(result.wallet, 10, 10)}</h2></div></div>
        <div className="walletHeaderActions"><button type="button" onClick={copyAddress}><Icon name="copy" />Copy address</button><a href={explorer} target="_blank" rel="noreferrer"><Icon name="external" />Explorer</a><span className={`resultState resultState--${result.status}`}>{statusLabel}</span></div>
      </div>
      {copyMessage ? <p className="copyNotice">{copyMessage}</p> : null}
      <StatusBanner status={result.status} message={result.message} />

      {result.status === 'found' ? (
        <>
          <div className="resultTabs" role="tablist">{[['overview', 'Overview'], ['evidence', 'Transaction Evidence'], ['safety', 'Safety']].map(([value, label]) => <button type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{label}</button>)}</div>
          <div className="tabContent">{tab === 'overview' ? <Overview data={result.data} /> : null}{tab === 'evidence' ? <Evidence data={result.data} /> : null}{tab === 'safety' ? <SafetyEvidence /> : null}</div>
          <div className="receiptActionBar"><div><Icon name="receipt" /><span><strong>Generate a receipt</strong><small>Create a clear community record from this match.</small></span></div><button type="button" className="primaryButton" onClick={() => receiptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Generate Receipt<Icon name="arrow" /></button></div>
          <Receipt data={result.data} receiptRef={receiptRef} logoSrc={logoSrc} />
        </>
      ) : null}

      {result.status === 'not-found' ? <div className="noMatchActions"><a href={explorer} target="_blank" rel="noreferrer"><Icon name="external" />Open wallet in Explorer</a><a href="#checker">Check another wallet</a></div> : null}
    </section>
  )
}
