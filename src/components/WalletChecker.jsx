import { useEffect, useState } from 'react'
import { findTrackedDistribution, TRACKED_DISTRIBUTION_WALLET, TRACKED_MINT } from '../services/solanaRpc'
import { isValidSolanaAddress, shortenAddress } from '../utils/solanaAddress'
import { Icon } from './Icons'

const LOOKUP_STEPS = [
  'Validating the public address…',
  'Finding the tracked token account…',
  'Checking recent confirmed transactions…',
  'Verifying the distribution source…',
]

export function LoadingSpinner({ small = false }) {
  return <span className={`loadingSpinner ${small ? 'loadingSpinner--small' : ''}`} aria-hidden="true" />
}

export function WalletChecker({ onResult }) {
  const [wallet, setWallet] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setStep(0)
      return undefined
    }

    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, LOOKUP_STEPS.length - 1))
    }, 1800)

    return () => window.clearInterval(timer)
  }, [isLoading])

  async function pasteAddress() {
    try {
      const value = await navigator.clipboard.readText()
      setWallet(value.trim())
      setMessage('')
    } catch {
      setMessage('Clipboard access was unavailable. Press and hold the field to paste manually.')
    }
  }

  async function submitLookup(event) {
    event.preventDefault()
    const value = wallet.trim()

    if (!value) {
      setMessage('Paste a public Solana wallet address to continue.')
      return
    }

    if (!isValidSolanaAddress(value)) {
      setMessage('Enter a complete Solana address that decodes to a valid 32-byte public key.')
      return
    }

    setWallet(value)
    setMessage('')
    setIsLoading(true)
    onResult({ status: 'loading', wallet: value })

    try {
      const lookup = await findTrackedDistribution(value)
      if (lookup.error) onResult({ status: 'error', wallet: value, message: lookup.message })
      else if (lookup.found) onResult({ status: 'found', wallet: value, data: lookup })
      else onResult({ status: 'not-found', wallet: value, message: lookup.reason })
    } catch {
      onResult({ status: 'error', wallet: value, message: 'The live lookup could not be completed. Please try again shortly.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="checkerSection" id="checker" aria-labelledby="checker-title">
      <div className="checkerTopline">
        <div><p className="eyebrow">Wallet checker</p><h2 id="checker-title">Check a public address</h2></div>
        <span className="networkBadge"><i /> Solana Mainnet</span>
      </div>

      <form className="walletForm" onSubmit={submitLookup} noValidate>
        <label htmlFor="walletAddress">Public wallet address</label>
        <div className="addressControl">
          <Icon name="wallet" />
          <input id="walletAddress" value={wallet} onChange={(event) => { setWallet(event.target.value); setMessage('') }} placeholder="Paste a Solana wallet address" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false" disabled={isLoading} aria-invalid={Boolean(message)} />
          {wallet && !isLoading ? <button className="iconButton" type="button" onClick={() => setWallet('')} aria-label="Clear address"><Icon name="close" /></button> : null}
          {!wallet && !isLoading ? <button className="pasteButton" type="button" onClick={pasteAddress}>Paste</button> : null}
        </div>

        <div className="checkerActions">
          <p>No connection, signature or secret wallet information is required.</p>
          <button className="primaryButton" type="submit" disabled={isLoading}>{isLoading ? <LoadingSpinner small /> : <Icon name="search" />}{isLoading ? 'Checking…' : 'Check Wallet'}</button>
        </div>

        {message ? <p className="validationMessage" role="alert">{message}</p> : null}
        {isLoading ? <div className="lookupProgress" role="status"><LoadingSpinner small /><span>{LOOKUP_STEPS[step]}</span></div> : null}
      </form>

      <div className="trackedConfig">
        <span>Tracked mint <b title={TRACKED_MINT}>{shortenAddress(TRACKED_MINT)}</b></span>
        <span>Distribution wallet <b title={TRACKED_DISTRIBUTION_WALLET}>{shortenAddress(TRACKED_DISTRIBUTION_WALLET)}</b></span>
      </div>
    </section>
  )
}
