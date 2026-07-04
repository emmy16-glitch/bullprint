import { useEffect, useMemo, useRef, useState } from 'react'
import { writeClipboard } from '../utils/clipboard'
import './LiveDistributionMonitor.css'

const DEFAULT_ENDPOINT = '/api/distributions'
const REFRESH_MS = 30_000
const PAGE_SIZE = 8

function shorten(value) {
  if (!value || value.length < 14) return value || '—'
  return `${value.slice(0, 6)}…${value.slice(-6)}`
}

function formatExactAmount(value) {
  const [whole = '0', fraction = ''] = String(value ?? '0').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

function formatCompactAmount(value) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return formatExactAmount(value)

  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(numeric) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(numeric)
}

function formatTime(timestamp) {
  if (!timestamp) return 'Not available'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000))
}

function TokenAmount({ value, suffix = '$ANSEM', className = '' }) {
  const [exact, setExact] = useState(false)
  const exactText = `${formatExactAmount(value)} ${suffix}`
  const compactText = `${formatCompactAmount(value)} ${suffix}`

  return (
    <button
      type="button"
      className={`token-amount ${className}`.trim()}
      onClick={() => setExact((current) => !current)}
      aria-label={`${exact ? 'Hide' : 'Show'} exact amount. ${exactText}`}
      title={exact ? 'Tap to show compact amount' : `Exact amount: ${exactText}`}
    >
      <strong>{exact ? exactText : compactText}</strong>
      <small>{exact ? 'Tap to shorten' : 'Tap for exact amount'}</small>
    </button>
  )
}

async function requestMonitorData(endpoint, signal) {
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Monitor returned HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (!payload?.ok) throw new Error('Monitor response was not successful')
  return payload
}

export default function LiveDistributionMonitor() {
  const endpoint = import.meta.env.VITE_DISTRIBUTION_MONITOR_URL || DEFAULT_ENDPOINT
  const hasDataRef = useRef(false)
  const copyTimeoutRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshWarning, setRefreshWarning] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [copyState, setCopyState] = useState({ address: '', status: '' })

  useEffect(() => {
    let active = true
    let activeController = null

    const finishRequest = (payload) => {
      if (!active) return
      hasDataRef.current = true
      setData(payload)
      setError('')
      setRefreshWarning('')
      setLoading(false)
      setUpdatedAt(new Date())
    }

    const failRequest = (requestError) => {
      if (!active || requestError?.name === 'AbortError') return
      console.error('Live distribution monitor request failed:', requestError)

      if (hasDataRef.current) {
        setRefreshWarning('The latest refresh failed. Showing the most recent verified data.')
      } else {
        setError('Live distribution data could not be loaded right now.')
        setLoading(false)
      }
    }

    const runRequest = () => {
      if (activeController) return
      activeController = new AbortController()

      requestMonitorData(endpoint, activeController.signal)
        .then(finishRequest)
        .catch(failRequest)
        .finally(() => {
          activeController = null
        })
    }

    runRequest()
    const intervalId = window.setInterval(runRequest, REFRESH_MS)

    return () => {
      active = false
      activeController?.abort()
      window.clearInterval(intervalId)
    }
  }, [endpoint])

  useEffect(() => () => window.clearTimeout(copyTimeoutRef.current), [])

  const refreshNow = async () => {
    setRefreshing(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)

    try {
      const payload = await requestMonitorData(endpoint, controller.signal)
      hasDataRef.current = true
      setData(payload)
      setError('')
      setRefreshWarning('')
      setUpdatedAt(new Date())
    } catch (requestError) {
      console.error('Manual monitor refresh failed:', requestError)

      if (hasDataRef.current) {
        setRefreshWarning(
          requestError?.name === 'AbortError'
            ? 'The refresh timed out. Showing the most recent verified data.'
            : 'The latest refresh failed. Showing the most recent verified data.',
        )
      } else {
        setError(
          requestError?.name === 'AbortError'
            ? 'The monitor took too long to respond. Please try again.'
            : 'Live distribution data could not be loaded right now.',
        )
      }
    } finally {
      window.clearTimeout(timeout)
      setRefreshing(false)
      setLoading(false)
    }
  }

  async function copyRecipient(address) {
    const copied = await writeClipboard(address)
    window.clearTimeout(copyTimeoutRef.current)
    setCopyState({ address, status: copied ? 'copied' : 'failed' })
    copyTimeoutRef.current = window.setTimeout(
      () => setCopyState({ address: '', status: '' }),
      1800,
    )
  }

  const monitoring = Boolean(data?.status?.monitoring)
  const backfillComplete = Boolean(data?.status?.backfillComplete)
  const totals = data?.totals
  const latest = data?.latestDistribution
  const allTransfers = data?.recentTransfers || []

  const filteredTransfers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return allTransfers

    return allTransfers.filter((transfer) =>
      transfer.recipient?.toLowerCase().includes(normalized)
      || transfer.signature?.toLowerCase().includes(normalized),
    )
  }, [allTransfers, query])

  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / PAGE_SIZE))
  const activePage = Math.min(page, totalPages)
  const transfers = filteredTransfers.slice(
    (activePage - 1) * PAGE_SIZE,
    activePage * PAGE_SIZE,
  )

  function updateQuery(value) {
    setQuery(value)
    setPage(1)
  }

  const resultCountText = query.trim()
    ? `${filteredTransfers.length} matching transfer${filteredTransfers.length === 1 ? '' : 's'}`
    : `Showing ${filteredTransfers.length} recent transfer${filteredTransfers.length === 1 ? '' : 's'}`

  return (
    <section className="monitor" id="live-distributions" aria-labelledby="monitor-title">
      <div className="monitor-toolbar">
        <div className="section-heading">
          <h2 id="monitor-title">Live Distribution Monitor</h2>
          <span
            className={`monitor-status${monitoring ? ' is-live' : ''}`}
            title={monitoring
              ? 'Automatic monitoring is active.'
              : 'Automatic monitoring is delayed. Indexed verified data remains available.'}
          >
            {monitoring ? 'Monitor active' : 'Monitor delayed'}
          </span>
        </div>
        <button
          className="monitor-refresh"
          type="button"
          onClick={refreshNow}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh data'}
        </button>
      </div>

      {!monitoring && data ? (
        <p className="monitor-status-note" role="status">
          Automatic monitoring is delayed. The completed indexed history remains available;
          use Refresh data to request the latest summary.
        </p>
      ) : null}

      {loading && !data ? (
        <div className="monitor-loading" role="status" aria-live="polite">
          <p>Loading verified $ANSEM distribution activity…</p>
        </div>
      ) : null}

      {error && !data ? (
        <div className="monitor-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={refreshNow}>Try again</button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className={`monitor-notice${backfillComplete ? ' is-complete' : ''}`}>
            <p>
              <strong>
                {backfillComplete ? 'Historical scan complete.' : 'Historical scan in progress.'}
              </strong>{' '}
              {backfillComplete
                ? 'The monitored history has been indexed and new activity continues to be added.'
                : 'Older transactions are scanned every minute while new distributions continue to be monitored.'}
            </p>
            {!backfillComplete ? (
              <div className="scan-progress" role="progressbar" aria-label="Historical scan in progress">
                <span />
              </div>
            ) : null}
            <small>
              {backfillComplete
                ? `${formatExactAmount(totals?.verifiedTransfers || 0)} verified transfers indexed.`
                : `${formatExactAmount(totals?.verifiedTransfers || 0)} verified transfers detected so far. This is an activity indicator, not a percentage estimate.`}
            </small>
          </div>

          {refreshWarning ? (
            <div className="monitor-refresh-warning" role="status">{refreshWarning}</div>
          ) : null}

          <div className="monitor-stats">
            <article>
              <span>{backfillComplete ? 'Total distributed' : 'Detected so far'}</span>
              <TokenAmount value={totals?.amount} />
              <small>{backfillComplete ? 'Indexed monitor history' : 'Still scanning older transfers'}</small>
            </article>
            <article>
              <span>Unique recipients</span>
              <strong>{formatExactAmount(totals?.uniqueRecipients || 0)}</strong>
              <small>Detected public wallet addresses</small>
            </article>
            <article>
              <span>Verified transfers</span>
              <strong>{formatExactAmount(totals?.verifiedTransfers || 0)}</strong>
              <small>Matched mint and distribution wallet</small>
            </article>
            <article>
              <span>Last detected</span>
              <strong>{totals?.lastDetectedAt ? formatTime(totals.lastDetectedAt) : '—'}</strong>
              <small>
                {updatedAt
                  ? `Page updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Waiting for data'}
              </small>
            </article>
          </div>

          <div className="latest-box">
            <div className="latest-summary">
              <div>
                <h3>Latest distribution</h3>
                <p>
                  {latest
                    ? `${latest.recipientCount} recipient${latest.recipientCount === 1 ? '' : 's'} across ${latest.transferCount} transfer${latest.transferCount === 1 ? '' : 's'}.`
                    : 'No verified distribution batch has been detected yet.'}
                </p>
              </div>
              <div className="latest-amount">
                {latest ? <TokenAmount value={latest.amount} /> : <strong>—</strong>}
                <small>{latest?.lastDetectedAt ? formatTime(latest.lastDetectedAt) : 'No timestamp available'}</small>
              </div>
            </div>

            <div className="transfer-tools">
              <label htmlFor="transfer-search">Search recent transfers</label>
              <input
                id="transfer-search"
                type="search"
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Recipient or transaction signature"
                autoComplete="off"
              />
              <span aria-live="polite">{resultCountText}</span>
            </div>

            <div className="evidence-table monitor-table">
              <div className="table-row table-head">
                <span>Recipient</span>
                <span>Amount</span>
                <span>Time</span>
                <span>Evidence</span>
              </div>

              {transfers.length ? transfers.map((transfer) => {
                const copied = copyState.address === transfer.recipient && copyState.status === 'copied'
                const copyFailed = copyState.address === transfer.recipient && copyState.status === 'failed'

                return (
                  <div className="table-row" key={`${transfer.signature}-${transfer.recipient}`}>
                    <div className="recipient-cell">
                      <a
                        className="chain-link recipient-link"
                        href={`https://solscan.io/account/${transfer.recipient}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={transfer.recipient}
                      >
                        {shorten(transfer.recipient)}
                      </a>
                      <button
                        type="button"
                        className="copy-recipient-btn"
                        onClick={() => copyRecipient(transfer.recipient)}
                        aria-label={`Copy recipient address ${transfer.recipient}`}
                      >
                        {copied ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy'}
                      </button>
                    </div>
                    <strong>{formatExactAmount(transfer.amount)} $ANSEM</strong>
                    <span>{formatTime(transfer.blockTime)}</span>
                    <a
                      className="chain-link transaction-link"
                      href={`https://solscan.io/tx/${transfer.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View transaction on Solscan ↗
                    </a>
                  </div>
                )
              }) : (
                <div className="empty-row">
                  {query
                    ? 'No recent transfers match that recipient or transaction signature.'
                    : 'No verified transfers have been indexed yet.'}
                </div>
              )}
            </div>

            {filteredTransfers.length > PAGE_SIZE ? (
              <nav className="transfer-pagination" aria-label="Recent transfer pages">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={activePage === 1}
                >
                  Previous
                </button>
                <span>Page {activePage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={activePage === totalPages}
                >
                  Next
                </button>
              </nav>
            ) : null}

            <p className="monitor-meta">
              Read-only public Solana data. Recipient and transaction links open independent Solscan records for verification.
            </p>
          </div>
        </>
      ) : null}
    </section>
  )
}
