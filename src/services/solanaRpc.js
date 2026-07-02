const WALLET_LOOKUP_ENDPOINT = '/api/wallet'
const TRACKED_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump'
const TRACKED_DISTRIBUTION_WALLET = 'GV6UUmNxz2RpKxmNAPadYKb7uQpszwqQAu3qLJxVdC52'
const REQUEST_TIMEOUT_MS = 15_000

function publicErrorMessage(status) {
  if (status === 429) return 'The lookup service is busy. Please wait a moment and try again.'
  if (status >= 500) return 'The $ANSEM lookup service is temporarily unavailable. Please try again shortly.'
  return 'The wallet lookup could not be completed. Please try again.'
}

async function requestWalletLookup(walletAddress) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const url = new URL(WALLET_LOOKUP_ENDPOINT, window.location.origin)
    url.searchParams.set('address', walletAddress)

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const error = new Error(payload?.error || publicErrorMessage(response.status))
      error.status = response.status
      throw error
    }

    return payload
  } finally {
    window.clearTimeout(timeout)
  }
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
      return {
        found: false,
        error: true,
        message: 'Historical indexing is still in progress. This wallet cannot be marked as not found until the scan completes. Please try again shortly.',
      }
    }

    return {
      found: false,
      reason: result?.reason || 'No matching $ANSEM distribution was found in the completed indexed history.',
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
