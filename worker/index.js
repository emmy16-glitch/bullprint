const MONITOR_ORIGIN = 'https://ansem-distribution-monitor.emmanuelokunlola16.workers.dev'
const DISTRIBUTION_CACHE_SECONDS = 15

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  })
}

function createCacheKey(request) {
  const url = new URL(request.url)
  url.searchParams.sort()
  return new Request(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
}

async function proxyMonitorRequest(request, pathname, options = {}) {
  const { cacheSeconds = 0, context } = options
  const sourceUrl = new URL(request.url)
  const upstreamUrl = new URL(pathname, MONITOR_ORIGIN)
  upstreamUrl.search = sourceUrl.search

  const canCache = cacheSeconds > 0 && request.method === 'GET' && typeof caches !== 'undefined'
  const cache = canCache ? caches.default : null
  const cacheKey = canCache ? createCacheKey(request) : null

  if (cache && cacheKey) {
    const cached = await cache.match(cacheKey)
    if (cached) {
      const cachedHeaders = new Headers(cached.headers)
      cachedHeaders.set('X-BullPrint-Cache', 'HIT')
      return new Response(cached.body, {
        status: cached.status,
        headers: cachedHeaders,
      })
    }
  }

  const headers = new Headers()
  headers.set('Accept', 'application/json')

  if (request.headers.get('content-type')) {
    headers.set('Content-Type', request.headers.get('content-type'))
  }

  const clientIp = request.headers.get('cf-connecting-ip')
  if (clientIp) headers.set('X-Real-IP', clientIp)

  const init = {
    method: request.method,
    headers,
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.text()
  }

  const upstreamResponse = await fetch(upstreamUrl, init)
  const responseHeaders = new Headers(upstreamResponse.headers)
  responseHeaders.set('Content-Type', 'application/json; charset=UTF-8')
  responseHeaders.set('X-BullPrint-Cache', 'MISS')

  if (cacheSeconds > 0 && upstreamResponse.ok) {
    responseHeaders.set(
      'Cache-Control',
      `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=30`,
    )
  } else {
    responseHeaders.set('Cache-Control', 'no-store')
  }

  const response = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  })

  if (cache && cacheKey && upstreamResponse.ok) {
    const cacheWrite = cache.put(cacheKey, response.clone())
    if (context?.waitUntil) context.waitUntil(cacheWrite)
    else await cacheWrite
  }

  return response
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/api/solana-rpc') {
        if (!['POST', 'OPTIONS'].includes(request.method)) {
          return json({ ok: false, error: 'POST requests only.' }, 405)
        }
        return proxyMonitorRequest(request, '/api/solana-rpc', { context })
      }

      if (url.pathname === '/api/wallet') {
        if (request.method !== 'GET') {
          return json({ ok: false, error: 'GET requests only.' }, 405)
        }
        return proxyMonitorRequest(request, '/api/wallet', { context })
      }

      if (url.pathname === '/api/distributions') {
        if (request.method !== 'GET') {
          return json({ ok: false, error: 'GET requests only.' }, 405)
        }
        return proxyMonitorRequest(request, '/api/distributions', {
          cacheSeconds: DISTRIBUTION_CACHE_SECONDS,
          context,
        })
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
