const DEFAULT_SOLANA_RPC_URL = 'https://solana-rpc.publicnode.com'
const REQUEST_TIMEOUT_MS = 15_000
const ALLOWED_RPC_METHODS = new Set([
  'getTokenAccountsByOwner',
  'getSignaturesForAddress',
  'getTransaction',
  'getHealth',
])

function sendJson(res, statusCode, body) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json')
  return res.status(statusCode).json(body)
}

function safeRpcError(id, code, message) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message },
  }
}

async function readRequestBody(req) {
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const bodyText = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(bodyText || '{}')
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed. Use POST for read-only Solana RPC lookups.' })
  }

  let rpcPayload

  try {
    rpcPayload = await readRequestBody(req)
  } catch {
    return sendJson(res, 400, safeRpcError(null, -32700, 'Invalid JSON request body.'))
  }

  const { id, jsonrpc = '2.0', method, params } = rpcPayload || {}

  if (!ALLOWED_RPC_METHODS.has(method)) {
    return sendJson(res, 400, safeRpcError(id, -32601, 'RPC method is not allowed by this read-only endpoint.'))
  }

  if (!Array.isArray(params)) {
    return sendJson(res, 400, safeRpcError(id, -32602, 'RPC params must be an array.'))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(process.env.SOLANA_RPC_URL || DEFAULT_SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc, id, method, params }),
      signal: controller.signal,
    })

    if (upstreamResponse.status === 403) {
      return sendJson(res, 403, safeRpcError(id, -32003, 'The Solana data provider rejected this request. BullPrint will try again when the RPC service is available.'))
    }

    if (upstreamResponse.status === 429) {
      return sendJson(res, 429, safeRpcError(id, -32029, 'The Solana data provider is rate-limiting requests. Please wait a moment and try again.'))
    }

    let upstreamPayload

    try {
      upstreamPayload = await upstreamResponse.json()
    } catch {
      return sendJson(res, 502, safeRpcError(id, -32002, 'The Solana data provider returned an invalid response.'))
    }

    return sendJson(res, upstreamResponse.ok ? 200 : upstreamResponse.status, upstreamPayload)
  } catch (error) {
    const message = error?.name === 'AbortError'
      ? 'The Solana data provider timed out. Please try again shortly.'
      : 'BullPrint could not reach the Solana data provider. Please try again shortly.'

    return sendJson(res, 502, safeRpcError(id, -32000, message))
  } finally {
    clearTimeout(timeout)
  }
}
