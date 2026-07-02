import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import ReceiptModal from './ReceiptModal'
import { formatDate, short } from './resultUtils'

const copy = (value) => navigator.clipboard?.writeText(value)

function Evidence({ data }) {
  const multipleTransfers = Number(data.transferCount || 0) > 1
  const rows = [
    ['Recipient wallet', data.recipient],
    ['Distribution wallet', data.sourceWallet],
    ['Tracked mint', data.tokenMint],
    ['Verified transfers', String(data.transferCount || 1)],
    [multipleTransfers ? 'Latest transaction signature' : 'Transaction signature', data.transactionSignature],
    [multipleTransfers ? 'Latest transfer time' : 'Block time', formatDate(data.blockTime)],
    ['Status', 'Confirmed'],
  ]

  return (
    <div className="evidence-table">
      {rows.map(([label, value]) => (
        <div className="table-row" key={label}>
          <span>{label}</span>
          <code>{value}</code>
          {value?.length > 12 ? (
            <button onClick={() => copy(value)} aria-label={`Copy ${label}`}>
              <Icon name="copy" />
            </button>
          ) : null}
          {label.includes('transaction') ? (
            <a href={data.explorerUrl} target="_blank" rel="noreferrer">
              Open in Explorer
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
  const data = result.data
  const wallet = result.wallet || data?.recipient
  const multipleTransfers = Number(data?.transferCount || 0) > 1

  return (
    <section className="result-workspace" ref={ref} aria-labelledby="result-title" aria-live="polite">
      <div className="result-top">
        <button onClick={onReset} className="back-btn">
          <Icon name="arrow" />Wallet Lookup Result
        </button>
        <div>
          <button onClick={() => copy(wallet)}><Icon name="copy" />Copy Address</button>
          <a href={`https://explorer.solana.com/address/${wallet}`} target="_blank" rel="noreferrer">
            <Icon name="external" />View on Solana Explorer
          </a>
        </div>
      </div>

      <div className="wallet-line">
        <span>Wallet</span>
        <code>{short(wallet)}</code>
        <b className={`result-badge ${found ? 'ok' : error ? 'bad' : 'neutral'}`}>
          {found ? 'Distribution found' : error ? 'Lookup unavailable' : 'No distribution found'}
        </b>
      </div>

      {found ? (
        <>
          <div className="success-banner">
            <Icon name="check" />
            <div>
              <h2 id="result-title">$ANSEM distribution found</h2>
              <p>
                {multipleTransfers
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
            <article><span>Verification</span><strong>Confirmed transfer{multipleTransfers ? 's' : ''}</strong></article>
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
        <div className={`state-card ${error ? 'error' : 'no-match'}`}>
          <Icon name={error ? 'alert' : 'shield'} />
          <h2 id="result-title">{error ? 'Live lookup unavailable' : 'No tracked distribution found'}</h2>
          <p>
            {error
              ? result.message
              : result.message || 'The wallet is valid, the historical index is complete, and no matching $ANSEM distribution was found.'}
          </p>
          <div>
            <button className="primary-btn" onClick={onReset}>{error ? 'Try again' : 'Check another wallet'}</button>
            <a href={`https://explorer.solana.com/address/${wallet}`} target="_blank" rel="noreferrer">Open wallet in Solana Explorer</a>
          </div>
        </div>
      )}
    </section>
  )
}
