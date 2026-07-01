import { useEffect, useState } from 'react'
import { findTrackedDistribution } from '../services/solanaRpc'
import { Icon } from './Icons'

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const progress = ['Validating wallet address…', 'Finding the tracked token account…', 'Checking recent confirmed transactions…', 'Verifying the distribution source…']

function decodeBase58(value) {
  let bytes = [0]
  for (const char of value) {
    const valueIndex = BASE58.indexOf(char)
    if (valueIndex < 0) return null
    let carry = valueIndex
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry) { bytes.push(carry & 0xff); carry >>= 8 }
  }
  for (const char of value) { if (char === '1') bytes.push(0); else break }
  return Uint8Array.from(bytes.reverse())
}

function validateSolanaAddress(address) {
  if (!address) return 'Enter a public Solana wallet address to continue.'
  if (![...address].every((char) => BASE58.includes(char))) return 'Use a valid Base58 Solana address. Characters like 0, O, I and l are not valid.'
  if (decodeBase58(address)?.length !== 32) return 'Solana wallet addresses must decode to exactly 32 bytes.'
  return ''
}

export default function WalletChecker({ onResult }) {
  const [wallet, setWallet] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)

  useEffect(() => {
    if (!loading) return undefined
    const id = window.setInterval(() => setProgressIndex((i) => (i + 1) % progress.length), 1700)
    return () => window.clearInterval(id)
  }, [loading])

  async function submit(event) {
    event.preventDefault()
    const trimmed = wallet.trim()
    const validation = validateSolanaAddress(trimmed)
    setError(validation)
    if (validation || loading) return
    setLoading(true); setProgressIndex(0); onResult({ status: 'loading', wallet: trimmed })
    const lookup = await findTrackedDistribution(trimmed)
    if (lookup.error) onResult({ status: 'error', wallet: trimmed, message: lookup.message })
    else if (lookup.found) onResult({ status: 'found', wallet: trimmed, data: lookup })
    else onResult({ status: 'not-found', wallet: trimmed, message: lookup.reason })
    setLoading(false)
  }

  async function paste() {
    if (loading) return
    const text = await navigator.clipboard?.readText?.()
    if (text) { setWallet(text.trim()); setError('') }
  }

  return (
    <form className="checker-card" id="checker" onSubmit={submit} noValidate>
      <h2>Check a wallet</h2>
      <label htmlFor="walletAddress">Public Solana address</label>
      <div className={`wallet-input ${error ? 'has-error' : ''}`}>
        <Icon name="wallet" />
        <input id="walletAddress" value={wallet} onChange={(e) => { setWallet(e.target.value); setError('') }} placeholder="Paste wallet address here" disabled={loading} autoComplete="off" aria-describedby="wallet-error wallet-progress" />
        {wallet && <button type="button" className="inline-btn" onClick={() => { setWallet(''); setError('') }} disabled={loading}>Clear</button>}
        <button type="button" className="inline-btn" onClick={paste} disabled={loading}><Icon name="copy" />Paste</button>
      </div>
      <p id="wallet-error" className="input-error" role="alert">{error}</p>
      <button className="primary-btn submit-btn" disabled={loading} type="submit">{loading && <span className="spinner" />}Check Wallet</button>
      <p id="wallet-progress" className="secure-line" aria-live="polite">{loading ? progress[progressIndex] : 'Secure · Read-only · Solana Mainnet'}</p>
    </form>
  )
}
