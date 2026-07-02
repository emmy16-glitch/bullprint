const MONITOR_ORIGIN = 'https://ansem-distribution-monitor.emmanuelokunlola16.workers.dev'

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

async function proxyMonitorRequest(request, pathname) {
  const sourceUrl = new URL(request.url)
  const upstreamUrl = new URL(pathname, MONITOR_ORIGIN)
  upstreamUrl.search = sourceUrl.search

  const headers = new Headers()
  headers.set('Accept', 'application/json')
  if (request.headers.get('content-type')) {
    headers.set('Content-Type', request.headers.get('content-type'))
  }

  const init = {
    method: request.method,
    headers,
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.text()
  }

  const upstreamResponse = await fetch(upstreamUrl, init)
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

    try {
      if (url.pathname === '/api/solana-rpc') {
        if (!['POST', 'OPTIONS'].includes(request.method)) {
          return json({ ok: false, error: 'POST requests only.' }, 405)
        }
        return proxyMonitorRequest(request, '/api/solana-rpc')
      }

      if (url.pathname === '/api/wallet') {
        if (request.method !== 'GET') {
          return json({ ok: false, error: 'GET requests only.' }, 405)
        }
        return proxyMonitorRequest(request, '/api/wallet')
      }

      if (url.pathname === '/api/distributions') {
        if (request.method !== 'GET') {
          return json({ ok: false, error: 'GET requests only.' }, 405)
        }
        return proxyMonitorRequest(request, '/api/distributions')
      }

      if (url.pathname.startsWith('/api/')) {
        return json({ ok: false, error: 'API route not found.' }, 404)
      }

      return env.ASSETS.fetch(request)
    } catch (error) {
      console.error('BullPrint API proxy failed', error)
      return json(
        {
          ok: false,
          error: 'The BullPrint data service is temporarily unavailable.',
        },
        502,
      )
    }
  },
}
