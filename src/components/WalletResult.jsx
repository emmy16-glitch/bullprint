import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import ReceiptModal from './ReceiptModal'
import { formatDate, short } from './resultUtils'

const copy = (value) => navigator.clipboard?.writeText(value)

function Evidence({ data }) {
  const multipleTransfers = Number(data.transferCount || 0) > 1
  const rows = [
    {
      label: 'Recipient wallet',
      value: data.recipient,
      href: `https://solscan.io/account/${data.recipient}`,
      linkLabel: 'View wallet',
    },
    {
      label: 'Distribution wallet',
      value: data.sourceWallet,
      href: `https://solscan.io/account/${data.sourceWallet}`,
      linkLabel: 'View source',
    },
    {
      label: 'Tracked mint',
      value: data.tokenMint,
      href: `https://solscan.io/token/${data.tokenMint}`,
      linkLabel: 'View token',
    },
    { label: 'Verified transfers', value: String(data.transferCount || 1) },
    {
      label: multipleTransfers ? 'Latest transaction signature' : 'Transaction signature',
      value: data.transactionSignature,
      href: `https://solscan.io/tx/${data.transactionSignature}`,
      linkLabel: 'View transaction',
    },
    {
      label: multipleTransfers ? 'Latest transfer time' : 'Block time',
      value: formatDate(data.blockTime),
    },
    { label: 'Verification source', value: data.verification || 'Confirmed transfer' },
    { label: 'Status', value: 'Confirmed' },
  ]

  return (
    <div className="evidence-table">
      {rows.map(({ label, value, href, linkLabel }) => (
        <div className="table-row" key={label}>
          <span>{label}</span>
          <code>{value}</code>
          {value?.length > 12 ? (
            <button onClick={() => copy(value)} aria-label={`Copy ${label}`}>
              <Icon name="copy" />
            </button>
          ) : null}
          {href ? (
            <a className="evidence-link" href={href} target="_blank" rel="noreferrer">
              {linkLabel} ↗
            </a>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function WalletResult({ result, onReset }) {
  const ref = useRef(null)
  const [tab, setTab] = useState('overview')
  const [modal, setModal] = useState(false)

  useEffect(() => {
    if (!['idle', 'loading'].includes(result.status)) {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  if (['idle', 'loading'].includes(result.status)) return null

  const found = result.status === 'found'
  const error = result.status === 'error'
  const indexing = result.status === 'indexing'
  const data = result.data
  const wallet = result.wallet || data?.recipient
  const multipleTransfers = Number(data?.transferCount || 0) > 1
  const liveMatch = data?.verification === 'Live RPC Match'

  const badgeClass = found ? 'ok' : error ? 'bad' : 'neutral'
  const badgeText = found
    ? 'Distribution found'
    : error
      ? 'Lookup unavailable'
      : indexing
        ? 'Verification in progress'
        : 'No distribution found'

  return (
    <section className="result-workspace" ref={ref} aria-labelledby="result-title" aria-live="polite">
      <div className="result-top">
        <button onClick={onReset} className="back-btn">
          <Icon name="arrow" />Wallet Lookup Result
        </button>
        <div>
          <button onClick={() => copy(wallet)}><Icon name="copy" />Copy Address</button>
          <a href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer">
            <Icon name="external" />View wallet on Solscan
          </a>
        </div>
      </div>

      <div className="wallet-line">
        <span>Wallet</span>
        <code>{short(wallet)}</code>
        <b className={`result-badge ${badgeClass}`}>{badgeText}</b>
      </div>

      {found ? (
        <>
          <div className="success-banner">
            <Icon name="check" />
            <div>
              <h2 id="result-title">$ANSEM distribution found</h2>
              <p>
                {liveMatch
                  ? 'A recent matching transfer from the tracked distribution wallet was confirmed directly through Solana RPC while historical indexing continues.'
                  : multipleTransfers
                    ? `${data.transferCount} verified transfers from the tracked distribution wallet were found in the indexed Solana Mainnet records.`
                    : 'A matching transfer from the tracked distribution wallet was confirmed in the indexed Solana Mainnet records.'}
              </p>
            </div>
          </div>

          <div className="summary-grid">
            <article className="strong">
              <span>{multipleTransfers ? 'Total amount received' : 'Amount received'}</span>
              <strong>{data.amountReceived} $ANSEM</strong>
            </article>
            <article>
              <span>{multipleTransfers ? 'Latest transfer' : 'Date received'}</span>
              <strong>{formatDate(data.blockTime)}</strong>
            </article>
            <article><span>Network</span><strong>{data.network}</strong></article>
            <article>
              <span>Verification</span>
              <strong>{liveMatch ? 'Live RPC match' : `Confirmed transfer${multipleTransfers ? 's' : ''}`}</strong>
            </article>
          </div>

          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</button>
            <button role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}>Transaction Evidence</button>
          </div>

          {tab === 'overview' ? (
            <div className="overview-grid">
              <Evidence data={data} />
              <article className="generate-card">
                <h3>Generate Receipt</h3>
                <p>Create a shareable receipt for this distribution.</p>
                <button className="primary-btn" onClick={() => setModal(true)}>Generate Receipt</button>
              </article>
            </div>
          ) : (
            <Evidence data={data} />
          )}

          {modal ? <ReceiptModal result={data} onClose={() => setModal(false)} /> : null}
        </>
      ) : (
        <div className={`state-card ${error ? 'error' : indexing ? 'indexing' : 'no-match'}`}>
          <Icon name={error ? 'alert' : 'shield'} />
          <h2 id="result-title">
            {error
              ? 'Live lookup unavailable'
              : indexing
                ? 'Historical verification in progress'
                : 'No tracked distribution found'}
          </h2>
          <p>
            {result.message ||
              'The wallet is valid, the historical index is complete, and no matching $ANSEM distribution was found.'}
          </p>
          <div>
            <button className="primary-btn" onClick={onReset}>
              {error || indexing ? 'Check again' : 'Check another wallet'}
            </button>
            <a className="evidence-link" href={`https://solscan.io/account/${wallet}`} target="_blank" rel="noreferrer">
              Open wallet on Solscan ↗
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
