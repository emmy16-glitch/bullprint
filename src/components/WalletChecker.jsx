import { useEffect, useRef, useState } from 'react'
import { findTrackedDistribution } from '../services/solanaRpc'
import { readClipboard } from '../utils/clipboard'
import { Icon } from './Icons'

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const progress = [
  'Validating wallet address…',
  'Searching indexed distribution records…',
  'Checking recent live Solana transfers…',
  'Preparing the wallet result…',
]

function decodeBase58(value) {
  if (!value) return new Uint8Array()

  const bytes = [0]
  for (const char of value) {
    const valueIndex = BASE58.indexOf(char)
    if (valueIndex < 0) return null
    let carry = valueIndex
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  let leadingZeroes = 0
  for (const char of value) {
    if (char === '1') leadingZeroes += 1
    else break
  }

  const decoded = bytes.reverse()
  const significantBytes = decoded.length === 1 && decoded[0] === 0 ? [] : decoded
  return Uint8Array.from([
    ...Array.from({ length: leadingZeroes }, () => 0),
    ...significantBytes,
  ])
}

function normalizeWalletText(value) {
  const trimmed = String(value ?? '').trim()
  const solscanMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?solscan\.io\/account\/([^/?#]+)/i,
  )
  const explorerMatch = trimmed.match(
    /^https?:\/\/explorer\.solana\.com\/address\/([^/?#]+)/i,
  )
  return (solscanMatch?.[1] || explorerMatch?.[1] || trimmed).replace(/\s+/g, '')
}

function validateSolanaAddress(address) {
  if (!address) return 'Enter a public Solana wallet address to continue.'
  if (![...address].every((char) => BASE58.includes(char))) {
    return 'Use a valid Base58 Solana address. Characters like 0, O, I and l are not valid.'
  }
  if (decodeBase58(address)?.length !== 32) {
    return 'Solana wallet addresses must decode to exactly 32 bytes.'
  }
  return ''
}

export default function WalletChecker({ onResult }) {
  const inputRef = useRef(null)
  const [wallet, setWallet] = useState('')
  const [error, setError] = useState('')
  const [pasteMessage, setPasteMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [progressIndex, setProgressIndex] = useState(0)

  useEffect(() => {
    if (!loading) return undefined
    const id = window.setInterval(
      () => setProgressIndex((index) => (index + 1) % progress.length),
      1700,
    )
    return () => window.clearInterval(id)
  }, [loading])

  const trimmedWallet = wallet.trim()
  const hasOnlyBase58 = Boolean(trimmedWallet)
    && [...trimmedWallet].every((char) => BASE58.includes(char))
  const decodedLength = hasOnlyBase58 ? decodeBase58(trimmedWallet)?.length : null
  const isValidAddress = decodedLength === 32

  function setNormalizedWallet(value) {
    const normalized = normalizeWalletText(value)
    setWallet(normalized)
    setError(normalized ? validateSolanaAddress(normalized) : '')
    setPasteMessage('')
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(0, 0)
    })
  }

  async function submit(event) {
    event.preventDefault()
    const trimmed = wallet.trim()
    const validation = validateSolanaAddress(trimmed)
    setError(validation)
    setPasteMessage('')
    if (validation || loading) return

    setLoading(true)
    setProgressIndex(0)
    onResult({ status: 'loading', wallet: trimmed })

    try {
      const lookup = await findTrackedDistribution(trimmed)

      if (lookup.error) {
        onResult({ status: 'error', wallet: trimmed, message: lookup.message })
      } else if (lookup.found) {
        onResult({ status: 'found', wallet: trimmed, data: lookup })
      } else if (lookup.pending) {
        onResult({ status: 'indexing', wallet: trimmed, message: lookup.message })
      } else {
        onResult({ status: 'not-found', wallet: trimmed, message: lookup.reason })
      }
    } catch {
      onResult({
        status: 'error',
        wallet: trimmed,
        message: 'The wallet lookup could not be completed. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  async function paste() {
    if (loading) return

    const clipboard = await readClipboard()
    if (!clipboard.ok) {
      setPasteMessage(
        'Automatic paste was blocked by your browser. Focus the field and press Ctrl+V, or touch and hold to paste on mobile.',
      )
      inputRef.current?.focus()
      return
    }

    const normalized = normalizeWalletText(clipboard.text)
    if (!normalized) {
      setPasteMessage('The clipboard does not contain a wallet address.')
      inputRef.current?.focus()
      return
    }

    setNormalizedWallet(normalized)
  }

  return (
    <form className="checker-card" id="checker" onSubmit={submit} noValidate>
      <h2>Check a wallet</h2>
      <label htmlFor="walletAddress">Public Solana address</label>
      <div className={`wallet-input ${error ? 'has-error' : ''}`}>
        <Icon name="wallet" />
        <input
          ref={inputRef}
          id="walletAddress"
          value={wallet}
          onChange={(event) => {
            const nextWallet = event.target.value
            setWallet(nextWallet)
            setPasteMessage('')
            if (error) setError(nextWallet.trim() ? validateSolanaAddress(nextWallet.trim()) : '')
          }}
          onBlur={() => {
            if (wallet.trim()) setError(validateSolanaAddress(wallet.trim()))
          }}
          onPaste={(event) => {
            const pastedText = event.clipboardData?.getData('text')
            if (!pastedText) return
            event.preventDefault()
            setNormalizedWallet(pastedText)
          }}
          placeholder="Paste wallet address here"
          disabled={loading}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          title={trimmedWallet || undefined}
          aria-describedby="wallet-error wallet-format wallet-paste-status wallet-progress"
          aria-invalid={Boolean(error)}
        />
        {wallet ? (
          <button
            type="button"
            className="inline-btn"
            onClick={() => {
              setWallet('')
              setError('')
              setPasteMessage('')
              inputRef.current?.focus()
            }}
            disabled={loading}
          >
            Clear
          </button>
        ) : null}
        <button type="button" className="inline-btn" onClick={paste} disabled={loading}>
          <Icon name="copy" />Paste
        </button>
      </div>

      {trimmedWallet ? (
        <div className={`wallet-input-details${isValidAddress ? ' is-valid' : ''}`}>
          <code className="wallet-address-preview">{trimmedWallet}</code>
          <span id="wallet-format">
            {trimmedWallet.length} characters
            {decodedLength !== null ? ` · ${decodedLength} decoded bytes` : ' · not valid Base58'}
            {isValidAddress ? ' · valid Solana address' : ''}
          </span>
        </div>
      ) : (
        <p id="wallet-format" className="wallet-format-hint">
          Paste a public wallet address or a Solscan account link. No wallet connection is required.
        </p>
      )}

      <p id="wallet-error" className="input-error" role="alert">{error}</p>
      <p id="wallet-paste-status" className="paste-status" role="status">{pasteMessage}</p>
      <button className="primary-btn submit-btn" disabled={loading} type="submit">
        {loading ? <span className="spinner" /> : null}
        Check Wallet
      </button>
      <p id="wallet-progress" className="secure-line" aria-live="polite">
        {loading ? progress[progressIndex] : 'Secure · Read-only · Solana Mainnet'}
      </p>
    </form>
  )
}
