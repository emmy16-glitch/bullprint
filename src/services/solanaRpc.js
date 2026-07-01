const RPC_ENDPOINT = 'https://api.mainnet.solana.com'
const TRACKED_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump'
const TRACKED_DISTRIBUTION_WALLET = 'GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_TOKEN_ACCOUNTS = 5
const SIGNATURE_LIMIT = 25
const MAX_TRANSACTIONS_TO_CHECK = 50

class SolanaRpcError extends Error {
  constructor(message, { retryable = false, rateLimited = false } = {}) {
    super(message)
    this.name = 'SolanaRpcError'
    this.retryable = retryable
    this.rateLimited = rateLimited
  }
}

function safeErrorMessage(error) {
  if (error?.rateLimited) {
    return 'The public Solana RPC endpoint is rate-limiting requests. Please wait a moment and try again.'
  }

  if (error?.retryable || error?.name === 'AbortError' || error instanceof TypeError) {
    return 'BullPrint could not reach the public Solana RPC endpoint. Please try again shortly.'
  }

  return error?.message || 'BullPrint could not complete the live Solana lookup. Please try again later.'
}

function isTemporaryNetworkError(error) {
  return error?.name === 'AbortError' || error instanceof TypeError || error?.retryable === true
}

async function rpcRequestOnce(method, params) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(RPC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new SolanaRpcError('The public Solana RPC endpoint is rate-limiting requests. Please wait a moment and try again.', { rateLimited: true })
      }

      throw new SolanaRpcError(`Solana RPC returned HTTP ${response.status}.`, { retryable: response.status >= 500 })
    }

    const payload = await response.json()

    if (payload.error) {
      throw new SolanaRpcError(payload.error.message || 'Solana RPC returned an error.')
    }

    return payload.result
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function rpcRequest(method, params) {
  try {
    return await rpcRequestOnce(method, params)
  } catch (error) {
    if (error?.rateLimited || !isTemporaryNetworkError(error)) {
      throw error
    }

    // One automatic retry is enough for transient network hiccups; 429s are not retried.
    return rpcRequestOnce(method, params)
  }
}

function rawTokenAmount(balance) {
  return BigInt(balance?.uiTokenAmount?.amount ?? '0')
}

function decimalsFor(balance) {
  return balance?.uiTokenAmount?.decimals ?? 0
}

function formatRawAmount(rawAmount, decimals) {
  const raw = rawAmount.toString()

  if (decimals === 0) return raw

  const padded = raw.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '')
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole
}

function accountKeyToString(accountKey) {
  if (typeof accountKey === 'string') return accountKey
  return accountKey?.pubkey || ''
}

function ownerForTokenBalance(transaction, balance) {
  if (balance?.owner) return balance.owner

  const accountKey = transaction?.transaction?.message?.accountKeys?.[balance?.accountIndex]
  return accountKeyToString(accountKey)
}

function tokenBalanceDeltas(transaction, walletAddress) {
  const deltas = new Map()
  const balances = [
    ...(transaction?.meta?.preTokenBalances || []).map((balance) => ({ balance, side: 'pre' })),
    ...(transaction?.meta?.postTokenBalances || []).map((balance) => ({ balance, side: 'post' })),
  ]

  for (const { balance, side } of balances) {
    if (balance.mint !== TRACKED_MINT) continue

    const owner = ownerForTokenBalance(transaction, balance)
    if (owner !== walletAddress && owner !== TRACKED_DISTRIBUTION_WALLET) continue

    const key = `${owner}:${balance.accountIndex}`
    const existing = deltas.get(key) || { owner, decimals: decimalsFor(balance), pre: 0n, post: 0n }
    existing[side] = rawTokenAmount(balance)
    existing.decimals = decimalsFor(balance)
    deltas.set(key, existing)
  }

  return [...deltas.values()]
}

function matchTransaction(transaction, walletAddress, signature) {
  if (!transaction || transaction?.meta?.err) return null

  const deltas = tokenBalanceDeltas(transaction, walletAddress)
  const recipientIncrease = deltas
    .filter((delta) => delta.owner === walletAddress)
    .reduce((sum, delta) => sum + (delta.post - delta.pre), 0n)
  const sourceDecrease = deltas
    .filter((delta) => delta.owner === TRACKED_DISTRIBUTION_WALLET)
    .reduce((sum, delta) => sum + (delta.pre - delta.post), 0n)

  if (recipientIncrease <= 0n || sourceDecrease <= 0n) return null

  const decimals = deltas.find((delta) => delta.owner === walletAddress)?.decimals ?? 0

  return {
    found: true,
    recipient: walletAddress,
    amountReceived: formatRawAmount(recipientIncrease, decimals),
    rawAmountReceived: recipientIncrease.toString(),
    decimals,
    tokenMint: TRACKED_MINT,
    sourceWallet: TRACKED_DISTRIBUTION_WALLET,
    transactionSignature: signature,
    blockTime: transaction.blockTime,
    network: 'Solana Mainnet',
    verification: 'Live RPC Match',
    explorerUrl: `https://explorer.solana.com/tx/${signature}`,
  }
}

export async function findTrackedDistribution(walletAddress) {
  try {
    const accounts = await rpcRequest('getTokenAccountsByOwner', [
      walletAddress,
      { mint: TRACKED_MINT },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ])

    const tokenAccounts = (accounts?.value || []).slice(0, MAX_TOKEN_ACCOUNTS)

    if (tokenAccounts.length === 0) {
      return {
        found: false,
        reason: 'No BullPrint tracked mint token accounts were found for this wallet.',
      }
    }

    const signatureMap = new Map()

    for (const account of tokenAccounts) {
      const signatures = await rpcRequest('getSignaturesForAddress', [
        account.pubkey,
        { commitment: 'confirmed', limit: SIGNATURE_LIMIT },
      ])

      for (const record of signatures || []) {
        if (record.err || !record.signature) continue
        if (!signatureMap.has(record.signature)) signatureMap.set(record.signature, record)
      }
    }

    const candidates = [...signatureMap.values()]
      .sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0))
      .slice(0, MAX_TRANSACTIONS_TO_CHECK)

    for (const candidate of candidates) {
      const transaction = await rpcRequest('getTransaction', [
        candidate.signature,
        { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
      ])
      const match = matchTransaction(transaction, walletAddress, candidate.signature)
      if (match) return match
    }

    return {
      found: false,
      reason: 'No configured distribution record was found within BullPrint’s limited recent transaction search.',
    }
  } catch (error) {
    return {
      found: false,
      error: true,
      message: safeErrorMessage(error),
    }
  }
}

export { TRACKED_DISTRIBUTION_WALLET, TRACKED_MINT }
