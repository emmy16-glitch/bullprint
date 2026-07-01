import { useEffect, useState } from 'react'
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
    loading: ['Live lookup', 'Checking Solana Mainnet', 'Validating token accounts and recent confirmed transactions.'],
    found: ['Distribution confirmed', '$ANSEM distribution found', 'A direct transfer matching the tracked mint and distribution wallet was found.'],
    'not-found': ['Lookup completed', 'No tracked distribution found', message],
    error: ['Lookup issue', 'Live lookup unavailable', message],
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
      <div>
        <code title={value}>{value}</code>
        <button type="button" onClick={handleCopy}><Icon name="copy" />{copied ? 'Copied' : 'Copy'}</button>
        {link ? <a href={link} target="_blank" rel="noreferrer"><Icon name="external" />Open</a> : null}
      </div>
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

function ReceiptPreview({ data, logoSrc }) {
  return (
    <article className="receiptCard">
      <div className="receiptHeader">
        <div><TokenLogo src={logoSrc} /><strong>$ANSEM Receipt</strong></div>
        <span><i /> Confirmed</span>
      </div>
      <p>Wallet distribution</p>
      <h3>{data.amountReceived} <small>$ANSEM</small></h3>
      <dl>
        <div><dt>Recipient</dt><dd>{shortenAddress(data.recipient, 8, 8)}</dd></div>
        <div><dt>Date</dt><dd>{formatDate(data.blockTime)}</dd></div>
        <div><dt>Network</dt><dd>{data.network}</dd></div>
      </dl>
      <footer>{shortenAddress(data.transactionSignature, 12, 12)}</footer>
    </article>
  )
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (const word of words) {
    const testLine = `${line}${word} `
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line.trim(), x, currentY)
      line = `${word} `
      currentY += lineHeight
    } else {
      line = testLine
    }
  }

  context.fillText(line.trim(), x, currentY)
  return currentY
}

function downloadReceipt(data) {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const context = canvas.getContext('2d')
  if (!context) return

  const gradient = context.createLinearGradient(0, 0, 1080, 1350)
  gradient.addColorStop(0, '#111722')
  gradient.addColorStop(1, '#080b10')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.strokeStyle = '#263241'
  context.lineWidth = 3
  context.strokeRect(70, 70, 940, 1210)

  context.fillStyle = '#4c8dff'
  context.beginPath()
  context.arc(150, 155, 48, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#08101c'
  context.font = '800 34px Arial'
  context.textAlign = 'center'
  context.fillText('$A', 150, 167)

  context.textAlign = 'left'
  context.fillStyle = '#f5f7fa'
  context.font = '700 42px Arial'
  context.fillText('$ANSEM Wallet Receipt', 225, 150)
  context.fillStyle = '#45d69a'
  context.font = '700 25px Arial'
  context.fillText('DISTRIBUTION CONFIRMED', 225, 190)

  context.fillStyle = '#8d9aaa'
  context.font = '600 27px Arial'
  context.fillText('AMOUNT RECEIVED', 110, 330)
  context.fillStyle = '#f5f7fa'
  context.font = '800 112px Arial'
  context.fillText(data.amountReceived, 110, 455)
  context.fillStyle = '#8ab4ff'
  context.font = '700 38px Arial'
  context.fillText('$ANSEM', 110, 510)

  const rows = [
    ['Recipient', shortenAddress(data.recipient, 12, 12)],
    ['Date', formatDate(data.blockTime)],
    ['Network', data.network],
    ['Transaction', shortenAddress(data.transactionSignature, 14, 14)],
  ]

  let rowY = 635
  for (const [label, value] of rows) {
    context.strokeStyle = '#263241'
    context.beginPath()
    context.moveTo(110, rowY - 35)
    context.lineTo(970, rowY - 35)
    context.stroke()
    context.fillStyle = '#8d9aaa'
    context.font = '500 26px Arial'
    context.fillText(label, 110, rowY)
    context.fillStyle = '#f5f7fa'
    context.font = '700 31px Arial'
    drawWrappedText(context, value, 110, rowY + 48, 850, 38)
    rowY += 145
  }

  context.fillStyle = '#667384'
  context.font = '500 24px Arial'
  context.fillText('Read-only community verification · Solana Mainnet', 110, 1225)

  const link = document.createElement('a')
  link.download = `ansem-receipt-${shortenAddress(data.recipient, 6, 6).replace('…', '-')}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function ReceiptModal({ data, logoSrc, onClose }) {
  useEffect(() => {
    function handleKeydown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeydown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [onClose])

  return (
    <div className="receiptModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="receiptModal" role="dialog" aria-modal="true" aria-labelledby="receipt-modal-title">
        <div className="receiptModalHeader">
          <div><span>Generated receipt</span><h3 id="receipt-modal-title">$ANSEM distribution receipt</h3></div>
          <button type="button" onClick={onClose} aria-label="Close receipt"><Icon name="close" /></button>
        </div>
        <ReceiptPreview data={data} logoSrc={logoSrc} />
        <div className="receiptModalActions">
          <button type="button" onClick={onClose}>Close</button>
          <button type="button" className="primaryButton" onClick={() => downloadReceipt(data)}>Download PNG</button>
        </div>
      </section>
    </div>
  )
}

export function WalletResult({ result, logoSrc }) {
  const [tab, setTab] = useState('overview')
  const [copyMessage, setCopyMessage] = useState('')
  const [receiptOpen, setReceiptOpen] = useState(false)

  useEffect(() => {
    setTab('overview')
    setCopyMessage('')
    setReceiptOpen(false)
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
          <div className="resultTabs" role="tablist">
            {[['overview', 'Overview'], ['evidence', 'Transaction Evidence']].map(([value, label]) => <button type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{label}</button>)}
          </div>
          <div className="tabContent">{tab === 'overview' ? <Overview data={result.data} /> : <Evidence data={result.data} />}</div>
          <div className="receiptActionBar"><div><Icon name="receipt" /><span><strong>Generate a receipt</strong><small>Create a downloadable image from this confirmed match.</small></span></div><button type="button" className="primaryButton" onClick={() => setReceiptOpen(true)}>Generate Receipt<Icon name="arrow" /></button></div>
          {receiptOpen ? <ReceiptModal data={result.data} logoSrc={logoSrc} onClose={() => setReceiptOpen(false)} /> : null}
        </>
      ) : null}

      {result.status === 'not-found' ? <div className="noMatchActions"><a href={explorer} target="_blank" rel="noreferrer"><Icon name="external" />Open wallet in Explorer</a><a href="#checker">Check another wallet</a></div> : null}
    </section>
  )
}
