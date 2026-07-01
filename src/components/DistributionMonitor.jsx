import { useCallback, useEffect, useState } from 'react'
import './DistributionMonitor.css'

const DEFAULT_ENDPOINT =
  'https://ansem-distribution-monitor.emmanuelokunlola16.workers.dev/api/distributions'

const REFRESH_INTERVAL_MS = 30_000

function formatAmount(value) {
  const [whole = '0', fraction = ''] = String(value ?? '0').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

function shortenAddress(address) {
  if (!address || address.length < 14) return address || '—'
  return `${address.slice(0, 6)}…${address.slice(-6)}`
}

function formatDate(timestamp) {
  if (!timestamp) return 'Not available'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000))
}

function MetricCard({ label, value, note, accent = false }) {
  return (
    <article className={`distributionMetric${accent ? ' distributionMetric--accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  )
}

function LoadingState() {
  return (
    <div className="distributionLoading" role="status" aria-live="polite">
      <span className="distributionSpinner" aria-hidden="true" />
      <div>
        <strong>Loading live distribution data</strong>
        <p>Reading the public monitor without connecting a wallet.</p>
      </div>
    </div>
  )
}

export function DistributionMonitor() {
  const endpoint =
    import.meta.env.VITE_DISTRIBUTION_MONITOR_URL || DEFAULT_ENDPOINT

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)

  const loadDistributionData = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true)
    else setLoading(true)

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)

    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Distribution monitor returned ${response.status}`)
      }

      const payload = await response.json()
      if (!payload?.ok) throw new Error('Distribution monitor is unavailable')

      setData(payload)
      setUpdatedAt(new Date())
      setError('')
    } catch (requestError) {
      console.error('Unable to load distribution activity:', requestError)
      setError(
        requestError?.name === 'AbortError'
          ? 'The live monitor took too long to respond. Please try again.'
          : 'Live distribution data could not be loaded right now.',
      )
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
      setRefreshing(false)
    }
  }, [endpoint])

  useEffect(() => {
    loadDistributionData()

    const interval = window.setInterval(
      () => loadDistributionData({ silent: true }),
      REFRESH_INTERVAL_MS,
    )

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadDistributionData({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [loadDistributionData])

  const monitoring = Boolean(data?.status?.monitoring)
  const backfillComplete = Boolean(data?.status?.backfillComplete)
  const totals = data?.totals
  const latest = data?.latestDistribution
  const transfers = data?.recentTransfers?.slice(0, 8) || []

  return (
    <section
      className="distributionSection"
      id="distribution"
      aria-labelledby="distribution-title"
    >
      <div className="distributionHeading">
        <div>
          <p className="eyebrow">Live distribution monitor</p>
          <h2 id="distribution-title">Follow $ANSEM distribution activity.</h2>
          <p>
            Public Solana data is checked automatically. New verified transfers
            appear here without a wallet connection.
          </p>
        </div>

        <div className="distributionControls">
          <span
            className={`distributionStatus${monitoring ? ' is-live' : ''}`}
          >
            <i aria-hidden="true" />
            {monitoring ? 'Monitor active' : 'Monitor delayed'}
          </span>
          <button
            className="distributionRefresh"
            type="button"
            onClick={() => loadDistributionData({ silent: true })}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
        </div>
      </div>

      {loading && !data ? <LoadingState /> : null}

      {error && !data ? (
        <div className="distributionError" role="alert">
          <div>
            <strong>Live activity is temporarily unavailable</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => loadDistributionData()}>
            Try again
          </button>
        </div>
      ) : null}

      {data ? (
        <div className="distributionDashboard">
          {!backfillComplete ? (
            <div className="distributionNotice" role="status">
              <span aria-hidden="true">↻</span>
              <p>
                <strong>Historical scan in progress.</strong> The total shown is
                the amount detected so far and will increase as older verified
                transfers are indexed.
              </p>
            </div>
          ) : (
            <div className="distributionNotice distributionNotice--complete">
              <span aria-hidden="true">✓</span>
              <p>
                <strong>Historical scan complete.</strong> The monitored history
                has been indexed.
              </p>
            </div>
          )}

          <div className="distributionMetrics">
            <MetricCard
              label={backfillComplete ? 'Total distributed' : 'Detected so far'}
              value={`${formatAmount(totals?.amount)} $ANSEM`}
              note={
                backfillComplete
                  ? 'Across the indexed monitor history'
                  : 'Updates while historical scanning continues'
              }
              accent
            />
            <MetricCard
              label="Latest distribution"
              value={latest ? `${formatAmount(latest.amount)} $ANSEM` : 'None yet'}
              note={
                latest
                  ? `${latest.transferCount} transfer${latest.transferCount === 1 ? '' : 's'}`
                  : 'Waiting for a verified batch'
              }
            />
            <MetricCard
              label="Unique recipients"
              value={formatAmount(totals?.uniqueRecipients || 0)}
              note="Detected wallet addresses"
            />
            <MetricCard
              label="Verified transfers"
              value={formatAmount(totals?.verifiedTransfers || 0)}
              note="Matched mint and source wallet"
            />
          </div>

          <div className="distributionActivity">
            <div className="distributionActivityHeader">
              <div>
                <span>Latest verified transfers</span>
                <strong>
                  {latest
                    ? `${latest.recipientCount} recipient${latest.recipientCount === 1 ? '' : 's'} in the latest batch`
                    : 'No recent batch detected'}
                </strong>
              </div>
              <small>
                {updatedAt
                  ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Waiting for update'}
              </small>
            </div>

            {transfers.length ? (
              <div className="distributionTransferList">
                {transfers.map((transfer) => (
                  <a
                    className="distributionTransfer"
                    href={transfer.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={`${transfer.signature}-${transfer.recipient}`}
                    aria-label={`Open ${transfer.amount} ANSEM transfer to ${transfer.recipient} in Solana Explorer`}
                  >
                    <span className="distributionTransferMark" aria-hidden="true">↗</span>
                    <span className="distributionTransferWallet">
                      <strong>{shortenAddress(transfer.recipient)}</strong>
                      <small>{formatDate(transfer.blockTime)}</small>
                    </span>
                    <span className="distributionTransferAmount">
                      <strong>{formatAmount(transfer.amount)} $ANSEM</strong>
                      <small>View evidence</small>
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="distributionEmpty">
                No verified transfers have been indexed yet.
              </p>
            )}
          </div>

          <p className="distributionFootnote">
            The monitor tracks one configured mint and distribution wallet. It
            does not imply official endorsement, ownership or financial safety.
          </p>
        </div>
      ) : null}
    </section>
  )
}
