const RPC_ENDPOINT = '/api/solana-rpc'
const TRACKED_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump'
const TRACKED_DISTRIBUTION_WALLET = 'GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_TOKEN_ACCOUNTS = 5
const SIGNATURE_LIMIT = 25
const MAX_TRANSACTIONS_TO_CHECK = 50

class SolanaRpcError extends Error {
  constructor(message, { retryable = false, rateLimited = false, forbidden = false } = {}) {
    super(message)
    this.name = 'SolanaRpcError'
    this.retryable = retryable
    this.rateLimited = rateLimited
    this.forbidden = forbidden
  }
}

function safeErrorMessage(error) {
  if (error?.forbidden) {
    return 'The Solana data provider rejected this request. $ANSEM Wallet Checker will try again when the RPC service is available.'
  }

  if (error?.rateLimited) {
    return 'The public Solana RPC endpoint is rate-limiting requests. Please wait a moment and try again.'
  }

  if (error?.retryable || error?.name === 'AbortError' || error instanceof TypeError) {
    return '$ANSEM Wallet Checker could not reach the public Solana RPC endpoint. Please try again shortly.'
  }

  return error?.message || '$ANSEM Wallet Checker could not complete the live Solana lookup. Please try again later.'
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
      if (response.status === 403) {
        throw new SolanaRpcError('The Solana data provider rejected this request. $ANSEM Wallet Checker will try again when the RPC service is available.', { forbidden: true })
      }

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

function pubkeyForAccountIndex(transaction, accountIndex) {
  const accountKey = transaction?.transaction?.message?.accountKeys?.[accountIndex]
  return accountKeyToString(accountKey)
}

function ownerForTokenBalance(transaction, balance) {
  if (balance?.owner) return balance.owner

  return pubkeyForAccountIndex(transaction, balance?.accountIndex)
}

function trackedTokenAccountBalances(transaction, walletAddress) {
  const accounts = new Map()
  const balances = [
    ...(transaction?.meta?.preTokenBalances || []).map((balance) => ({ balance, side: 'pre' })),
    ...(transaction?.meta?.postTokenBalances || []).map((balance) => ({ balance, side: 'post' })),
  ]

  for (const { balance, side } of balances) {
    if (balance.mint !== TRACKED_MINT) continue

    const owner = ownerForTokenBalance(transaction, balance)
    if (owner !== walletAddress && owner !== TRACKED_DISTRIBUTION_WALLET) continue

    const tokenAccount = pubkeyForAccountIndex(transaction, balance.accountIndex)
    if (!tokenAccount) continue

    const existing = accounts.get(tokenAccount) || {
      tokenAccount,
      owner,
      mint: balance.mint,
      decimals: decimalsFor(balance),
      pre: 0n,
      post: 0n,
    }

    existing[side] = rawTokenAmount(balance)
    existing.owner = owner
    existing.decimals = decimalsFor(balance)
    accounts.set(tokenAccount, existing)
  }

  return accounts
}

function parsedInstructionAmount(info) {
  const rawAmount = info?.tokenAmount?.amount ?? info?.amount
  if (!rawAmount) return 0n

  return BigInt(rawAmount)
}

function isParsedTrackedTokenTransfer(instruction) {
  const parsed = instruction?.parsed
  if (!parsed || instruction?.program !== 'spl-token') return false
  if (parsed.type !== 'transfer' && parsed.type !== 'transferChecked') return false
  if (parsed.info?.mint && parsed.info.mint !== TRACKED_MINT) return false

  return true
}

function parsedInstructions(transaction) {
  const topLevelInstructions = transaction?.transaction?.message?.instructions || []
  const innerInstructions = (transaction?.meta?.innerInstructions || [])
    .flatMap((innerInstructionGroup) => innerInstructionGroup.instructions || [])

  return [...topLevelInstructions, ...innerInstructions]
}

function findDirectTrackedTransfer(transaction, walletAddress) {
  const tokenAccounts = trackedTokenAccountBalances(transaction, walletAddress)

  for (const instruction of parsedInstructions(transaction)) {
    if (!isParsedTrackedTokenTransfer(instruction)) continue

    const info = instruction.parsed.info || {}
    const source = tokenAccounts.get(info.source)
    const destination = tokenAccounts.get(info.destination)
    const instructionAmount = parsedInstructionAmount(info)

    if (!source || !destination || instructionAmount <= 0n) continue
    if (source.mint !== TRACKED_MINT || destination.mint !== TRACKED_MINT) continue
    if (source.owner !== TRACKED_DISTRIBUTION_WALLET || destination.owner !== walletAddress) continue

    const recipientIncrease = destination.post - destination.pre
    const sourceDecrease = source.pre - source.post

    // Balance deltas validate this exact parsed transfer without allowing other
    // unrelated changes in a batched transaction to create a false match.
    if (recipientIncrease < instructionAmount || sourceDecrease < instructionAmount) continue

    return {
      amountReceived: instructionAmount,
      decimals: destination.decimals,
    }
  }

  return null
}

function matchTransaction(transaction, walletAddress, signature) {
  if (!transaction || transaction?.meta?.err) return null

  const directTransfer = findDirectTrackedTransfer(transaction, walletAddress)
  if (!directTransfer) return null

  return {
    found: true,
    recipient: walletAddress,
    amountReceived: formatRawAmount(directTransfer.amountReceived, directTransfer.decimals),
    rawAmountReceived: directTransfer.amountReceived.toString(),
    decimals: directTransfer.decimals,
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
        reason: 'No tracked $ANSEM mint token accounts were found for this wallet.',
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
      reason: 'No matching $ANSEM distribution was found within the recent transaction range checked.',
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
