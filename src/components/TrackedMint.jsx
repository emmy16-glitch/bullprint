import { useState } from 'react'
import { Icon } from './Icons'

const MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump'

export default function TrackedMint() {
  const [copied, setCopied] = useState(false)

  async function copyMint() {
    await navigator.clipboard?.writeText?.(MINT)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <aside className="mint-card" aria-labelledby="tracked-mint-title">
      <div className="mint-card-copy">
        <span className="mint-label" id="tracked-mint-title">Configured $ANSEM mint</span>
        <code title={MINT}>{MINT}</code>
        <p>Verify that this checker is tracking the token you expect before trusting any result.</p>
      </div>
      <div className="mint-actions">
        <button type="button" className="mint-action" onClick={copyMint}>
          <Icon name="copy" />{copied ? 'Copied' : 'Copy mint'}
        </button>
        <a
          className="mint-action"
          href={`https://solscan.io/token/${MINT}`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="external" />Solscan
        </a>
        <a
          className="mint-action"
          href={`https://birdeye.so/token/${MINT}?chain=solana`}
          target="_blank"
          rel="noreferrer"
        >
          <Icon name="external" />Birdeye
        </a>
      </div>
    </aside>
  )
}

export { MINT }
