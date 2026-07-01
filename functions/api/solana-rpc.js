const WORKER_RPC_ENDPOINT =
  'https://ansem-distribution-monitor.emmanuelokunlola16.workers.dev/api/solana-rpc';

export async function onRequest({ request }) {
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
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'POST requests only.' },
      }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Cache-Control': 'no-store',
          Allow: 'POST, OPTIONS',
        },
      },
    );
  }

  const forwardedRequest = new Request(WORKER_RPC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: await request.text(),
  });

  const response = await fetch(forwardedRequest);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
