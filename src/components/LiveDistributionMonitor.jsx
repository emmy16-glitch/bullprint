import { useEffect, useRef, useState } from 'react'
import './LiveDistributionMonitor.css'

const DEFAULT_ENDPOINT =
  'https://ansem-distribution-monitor.emmanuelokunlola16.workers.dev/api/distributions'

const REFRESH_MS = 30_000

function shorten(value) {
  if (!value || value.length < 14) return value || '—'
  return `${value.slice(0, 6)}…${value.slice(-6)}`
}

function formatAmount(value) {
  const [whole = '0', fraction = ''] = String(value ?? '0').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

function formatTime(timestamp) {
  if (!timestamp) return 'Not available'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000))
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
  const endpoint =
    import.meta.env.VITE_DISTRIBUTION_MONITOR_URL || DEFAULT_ENDPOINT

  const hasDataRef = useRef(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [refreshWarning, setRefreshWarning] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)

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
        setRefreshWarning(
          'The latest refresh failed. Showing the most recent verified data.',
        )
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

  const monitoring = Boolean(data?.status?.monitoring)
  const backfillComplete = Boolean(data?.status?.backfillComplete)
  const totals = data?.totals
  const latest = data?.latestDistribution
  const transfers = data?.recentTransfers?.slice(0, 8) || []

  return (
    <section className="monitor" id="live-distributions" aria-labelledby="monitor-title">
      <div className="monitor-toolbar">
        <div className="section-heading">
          <h2 id="monitor-title">Live Distribution Monitor</h2>
          <span className={`monitor-status${monitoring ? ' is-live' : ''}`}>
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
                {backfillComplete
                  ? 'Historical scan complete.'
                  : 'Historical scan in progress.'}
              </strong>{' '}
              {backfillComplete
                ? 'The monitored history has been indexed.'
                : 'The total shown is the amount detected so far and may continue to increase.'}
            </p>
          </div>

          {refreshWarning ? (
            <div className="monitor-refresh-warning" role="status">
              {refreshWarning}
            </div>
          ) : null}

          <div className="monitor-stats">
            <article>
              <span>{backfillComplete ? 'Total distributed' : 'Detected so far'}</span>
              <strong>{formatAmount(totals?.amount)} $ANSEM</strong>
              <small>{backfillComplete ? 'Indexed monitor history' : 'Still scanning older transfers'}</small>
            </article>
            <article>
              <span>Unique recipients</span>
              <strong>{formatAmount(totals?.uniqueRecipients || 0)}</strong>
              <small>Detected public wallet addresses</small>
            </article>
            <article>
              <span>Verified transfers</span>
              <strong>{formatAmount(totals?.verifiedTransfers || 0)}</strong>
              <small>Matched mint and distribution wallet</small>
            </article>
            <article>
              <span>Last detected</span>
              <strong>{totals?.lastDetectedAt ? formatTime(totals.lastDetectedAt) : '—'}</strong>
              <small>{updatedAt ? `Page updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for data'}</small>
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
                <strong>{latest ? `${formatAmount(latest.amount)} $ANSEM` : '—'}</strong>
                <small>{latest?.lastDetectedAt ? formatTime(latest.lastDetectedAt) : 'No timestamp available'}</small>
              </div>
            </div>

            <div className="evidence-table monitor-table">
              <div className="table-row table-head">
                <span>Recipient</span>
                <span>Amount</span>
                <span>Time</span>
                <span>Evidence</span>
              </div>

              {transfers.length ? transfers.map((transfer) => (
                <div className="table-row" key={`${transfer.signature}-${transfer.recipient}`}>
                  <code title={transfer.recipient}>{shorten(transfer.recipient)}</code>
                  <strong>{formatAmount(transfer.amount)} $ANSEM</strong>
                  <span>{formatTime(transfer.blockTime)}</span>
                  <a href={transfer.explorerUrl} target="_blank" rel="noreferrer">
                    View transaction
                  </a>
                </div>
              )) : (
                <div className="empty-row">No verified transfers have been indexed yet.</div>
              )}
            </div>

            <p className="monitor-meta">
              Read-only public Solana data. This tool tracks one configured mint and distribution wallet and does not imply official endorsement.
            </p>
          </div>
        </>
      ) : null}
    </section>
  )
}
