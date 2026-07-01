const RPC_PROXY_URL =
  'https://ansem-distribution-monitor.emmanuelokunlola16.workers.dev/api/solana-rpc';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

async function handleRpcRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (request.method !== 'POST') {
    return json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'POST requests only.' },
      },
      405,
      { Allow: 'POST, OPTIONS' },
    );
  }

  const upstream = await fetch(RPC_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: await request.text(),
  });

  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/solana-rpc') {
      return handleRpcRequest(request);
    }

    return env.ASSETS.fetch(request);
  },
};
