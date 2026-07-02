import monitor from './index.js';

const ALLOWED_RPC_METHODS = new Set([
  'getTokenAccountsByOwner',
  'getSignaturesForAddress',
  'getTransaction',
  'getHealth',
]);

const RPC_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const API_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(payload, status = 200, headers = RPC_HEADERS) {
  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

function rpcError(id, code, message, status) {
  return json(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code, message },
    },
    status,
  );
}

function clientKey(request, route) {
  const client = request.headers.get('cf-connecting-ip') || 'anonymous';
  return `${route}:${client}`;
}

async function enforceRateLimit(request, binding, route, headers) {
  if (!binding?.limit) return null;

  const { success } = await binding.limit({
    key: clientKey(request, route),
  });

  if (success) return null;

  return json(
    {
      ok: false,
      error: 'Too many requests. Please wait one minute and try again.',
    },
    429,
    {
      ...headers,
      'Retry-After': '60',
    },
  );
}

async function getRpcUrl(env) {
  const binding = env.SOLANA_RPC_URL;
  if (!binding) throw new Error('SOLANA_RPC_URL binding is missing');
  return typeof binding.get === 'function' ? binding.get() : binding;
}

async function handleRpcProxy(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: RPC_HEADERS });
  }

  if (request.method !== 'POST') {
    return rpcError(null, -32600, 'POST requests only.', 405);
  }

  const limited = await enforceRateLimit(
    request,
    env.RPC_RATE_LIMITER,
    'solana-rpc',
    RPC_HEADERS,
  );
  if (limited) return limited;

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 25_000) {
    return rpcError(null, -32600, 'Request body is too large.', 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, 'Invalid JSON request body.', 400);
  }

  const id = body?.id ?? null;
  const method = body?.method;
  const params = body?.params ?? [];

  if (body?.jsonrpc !== '2.0' || typeof method !== 'string' || !Array.isArray(params)) {
    return rpcError(id, -32600, 'Invalid JSON-RPC request.', 400);
  }

  if (!ALLOWED_RPC_METHODS.has(method)) {
    return rpcError(id, -32601, 'This Solana RPC method is not allowed.', 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const rpcUrl = await getRpcUrl(env);
    const upstream = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: controller.signal,
    });

    if (upstream.status === 403) {
      return rpcError(id, -32003, 'The Solana data provider rejected this request.', 503);
    }

    if (upstream.status === 429) {
      return rpcError(id, -32029, 'The Solana data provider is rate-limiting requests.', 429);
    }

    if (!upstream.ok) {
      return rpcError(id, -32000, 'The Solana data provider is temporarily unavailable.', 502);
    }

    const payload = await upstream.json();
    return json(payload);
  } catch (error) {
    console.error('RPC proxy request failed', error);
    return rpcError(
      id,
      -32000,
      error?.name === 'AbortError'
        ? 'The Solana data provider timed out.'
        : 'The Solana data provider is temporarily unavailable.',
      error?.name === 'AbortError' ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    if (url.pathname === '/api/solana-rpc') {
      return handleRpcProxy(request, env);
    }

    if (request.method !== 'OPTIONS'
      && (url.pathname === '/api/wallet' || url.pathname === '/api/distributions')) {
      const limited = await enforceRateLimit(
        request,
        env.PUBLIC_API_RATE_LIMITER,
        url.pathname,
        API_HEADERS,
      );
      if (limited) return limited;
    }

    return monitor.fetch(request, env, context);
  },

  async scheduled(controller, env, context) {
    return monitor.scheduled(controller, env, context);
  },
};
