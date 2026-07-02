const SOLANA_RPC_PROXY_URL =
  'https://ansem-distribution-monitor.emmanuelokunlola16.workers.dev/api/solana-rpc'

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })
}

async function proxySolanaRpc(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...JSON_HEADERS,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (request.method !== 'POST') {
    return json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'POST requests only.' },
      },
      405,
    )
  }

  const requestBody = await request.text()

  const upstreamResponse = await fetch(SOLANA_RPC_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: requestBody,
  })

  const responseHeaders = new Headers(upstreamResponse.headers)
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.set('Content-Type', 'application/json; charset=UTF-8')

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/solana-rpc') {
      try {
        return await proxySolanaRpc(request)
      } catch (error) {
        console.error('Solana RPC proxy failed', error)
        return json(
          {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32000,
              message: 'The Solana lookup service is temporarily unavailable.',
            },
          },
          502,
        )
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ ok: false, error: 'API route not found.' }, 404)
    }

    return env.ASSETS.fetch(request)
  },
}
