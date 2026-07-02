const WALLET_LOOKUP_ENDPOINT = '/api/wallet'
const RPC_ENDPOINT = '/api/solana-rpc'
const TRACKED_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump'
const TRACKED_DISTRIBUTION_WALLET = 'GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_TOKEN_ACCOUNTS = 3
const MAX_RECENT_TRANSACTIONS = 40
const TRANSACTION_BATCH_SIZE = 5

function publicErrorMessage(status) {
  if (status === 429) return 'The lookup service is busy. Please wait a moment and try again.'
  if (status >= 500) return 'The $ANSEM lookup service is temporarily unavailable. Please try again shortly.'
  return 'The wallet lookup could not be completed. Please try again.'
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

async function requestWalletLookup(walletAddress) {
  const url = new URL(WALLET_LOOKUP_ENDPOINT, window.location.origin)
  url.searchParams.set('address', walletAddress)

  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(payload?.error || publicErrorMessage(response.status))
    error.status = response.status
    throw error
  }

  return payload
}

async function rpcRequest(method, params) {
  const response = await fetchWithTimeout(RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.error) {
    const error = new Error(
      payload?.error?.message || publicErrorMessage(response.status),
    )
    error.status = response.status
    throw error
  }

  return payload.result
}

function accountKey(value) {
  return typeof value === 'string' ? value : value?.pubkey
}

function flattenInstructions(transaction) {
  const top = transaction?.transaction?.message?.instructions || []
  const inner = transaction?.meta?.innerInstructions || []
  return [...top, ...inner.flatMap((group) => group.instructions || [])]
}

function formatRaw(rawValue, decimals) {
  const raw = String(rawValue || '0')
  const places = Number(decimals || 0)
  if (!places) return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const padded = raw.padStart(places + 1, '0')
  const whole = padded.slice(0, -places)
  const fraction = padded.slice(-places).replace(/0+$/, '')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

function findTransferInTransaction(transaction, walletAddress, signature) {
  if (!transaction || transaction.meta?.err) return null

  const accountKeys = (transaction.transaction?.message?.accountKeys || []).map(accountKey)
  const indexByKey = new Map(accountKeys.map((key, index) => [key, index]))
  const tokenMeta = new Map()

  for (const balance of [
    ...(transaction.meta?.preTokenBalances || []),
    ...(transaction.meta?.postTokenBalances || []),
  ]) {
    tokenMeta.set(balance.accountIndex, {
      owner: balance.owner,
      mint: balance.mint,
      decimals: balance.uiTokenAmount?.decimals,
    })
  }

  let totalRaw = 0n
  let decimals = 0
  let matched = false

  for (const instruction of flattenInstructions(transaction)) {
    const parsed = instruction?.parsed
    if (!parsed || !['transfer', 'transferChecked'].includes(parsed.type)) continue

    const info = parsed.info || {}
    const sourceMeta = tokenMeta.get(indexByKey.get(info.source)) || {}
    const destinationMeta = tokenMeta.get(indexByKey.get(info.destination)) || {}
    const mint = info.mint || sourceMeta.mint || destinationMeta.mint
    const sourceOwner = sourceMeta.owner || info.authority
    const recipient = destinationMeta.owner || info.destination
    const amountRaw = info.tokenAmount?.amount || info.amount
    const transferDecimals =
      info.tokenAmount?.decimals ?? sourceMeta.decimals ?? destinationMeta.decimals

    if (sourceOwner !== TRACKED_DISTRIBUTION_WALLET) continue
    if (mint !== TRACKED_MINT || recipient !== walletAddress) continue
    if (!amountRaw || transferDecimals === undefined || transferDecimals === null) continue

    totalRaw += BigInt(amountRaw)
    decimals = Number(transferDecimals)
    matched = true
  }

  if (!matched) return null

  return {
    found: true,
    recipient: walletAddress,
    amountReceived: formatRaw(totalRaw.toString(), decimals),
    rawAmountReceived: totalRaw.toString(),
    decimals,
    tokenMint: TRACKED_MINT,
    sourceWallet: TRACKED_DISTRIBUTION_WALLET,
    transactionSignature: signature,
    blockTime: transaction.blockTime,
    network: 'Solana Mainnet',
    verification: 'Live RPC Match',
    explorerUrl: `https://explorer.solana.com/tx/${signature}`,
    transferCount: 1,
  }
}

async function findRecentLiveTransfer(walletAddress) {
  const accountResult = await rpcRequest('getTokenAccountsByOwner', [
    walletAddress,
    { mint: TRACKED_MINT },
    { encoding: 'jsonParsed', commitment: 'confirmed' },
  ])

  const tokenAccounts = (accountResult?.value || []).slice(0, MAX_TOKEN_ACCOUNTS)
  if (!tokenAccounts.length) return null

  const signatureMap = new Map()

  for (const account of tokenAccounts) {
    const signatures = await rpcRequest('getSignaturesForAddress', [
      account.pubkey,
      { limit: 100, commitment: 'confirmed' },
    ])

    for (const record of signatures || []) {
      if (!record?.signature || record.err) continue
      if (!signatureMap.has(record.signature)) signatureMap.set(record.signature, record)
    }
  }

  const candidates = [...signatureMap.values()]
    .sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0))
    .slice(0, MAX_RECENT_TRANSACTIONS)

  for (let index = 0; index < candidates.length; index += TRANSACTION_BATCH_SIZE) {
    const batch = candidates.slice(index, index + TRANSACTION_BATCH_SIZE)
    const transactions = await Promise.all(
      batch.map(async (candidate) => {
        try {
          const transaction = await rpcRequest('getTransaction', [
            candidate.signature,
            {
              encoding: 'jsonParsed',
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            },
          ])
          return findTransferInTransaction(transaction, walletAddress, candidate.signature)
        } catch {
          return null
        }
      }),
    )

    const match = transactions.find(Boolean)
    if (match) return match
  }

  return null
}

export async function findTrackedDistribution(walletAddress) {
  try {
    const result = await requestWalletLookup(walletAddress)

    if (result?.found) {
      return {
        found: true,
        recipient: walletAddress,
        amountReceived: result.amountReceived,
        rawAmountReceived: result.rawAmountReceived,
        decimals: result.decimals,
        tokenMint: result.tokenMint || TRACKED_MINT,
        sourceWallet: result.sourceWallet || TRACKED_DISTRIBUTION_WALLET,
        transactionSignature: result.transactionSignature,
        blockTime: result.blockTime,
        network: 'Solana Mainnet',
        verification: 'Indexed D1 Match',
        explorerUrl: result.explorerUrl,
        transferCount: result.transferCount,
      }
    }

    if (result?.indexing) {
      try {
        const liveMatch = await findRecentLiveTransfer(walletAddress)
        if (liveMatch) return liveMatch
      } catch {
        // The indexed lookup remains authoritative; a failed best-effort live
        // lookup should still be presented as indexing rather than an outage.
      }

      return {
        found: false,
        pending: true,
        message:
          'The complete historical scan is still running. A recent live Solana check did not confirm a matching transfer yet, so this wallet has not been marked as not found.',
      }
    }

    return {
      found: false,
      reason:
        result?.reason ||
        'No matching $ANSEM distribution was found in the completed indexed history.',
    }
  } catch (error) {
    return {
      found: false,
      error: true,
      message:
        error?.name === 'AbortError'
          ? 'The wallet lookup timed out. Please try again.'
          : error?.message || 'The wallet lookup could not be completed. Please try again.',
    }
  }
}

export { TRACKED_DISTRIBUTION_WALLET, TRACKED_MINT }
