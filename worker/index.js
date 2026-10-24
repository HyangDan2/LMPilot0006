const NVIDIA_ORIGIN = 'https://integrate.api.nvidia.com';
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const ROUTES = new Map([
  ['/v1/models', 'GET'],
  ['/v1/chat/completions', 'POST'],
]);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
}

function errorResponse(status, message, origin) {
  return new Response(message, {
    status,
    headers: {
      ...(origin ? corsHeaders(origin) : {}),
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readBoundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN;
    if (!allowedOrigin || request.headers.get('Origin') !== allowedOrigin) {
      return errorResponse(403, 'Forbidden');
    }

    const url = new URL(request.url);
    const method = ROUTES.get(url.pathname);
    if (!method) return errorResponse(404, 'Not found', allowedOrigin);

    if (request.method === 'OPTIONS') {
      if (request.headers.get('Access-Control-Request-Method') !== method) {
        return errorResponse(405, 'Method not allowed', allowedOrigin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
    }
    if (request.method !== method) {
      return errorResponse(405, 'Method not allowed', allowedOrigin);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ') || authorization.length <= 'Bearer '.length) {
      return errorResponse(401, 'API key required', allowedOrigin);
    }

    let body;
    if (method === 'POST') {
      if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
        return errorResponse(415, 'JSON required', allowedOrigin);
      }
      body = await readBoundedBody(request);
      if (!body) return errorResponse(413, 'Request too large', allowedOrigin);
    }

    try {
      const upstream = await fetch(`${NVIDIA_ORIGIN}${url.pathname}`, {
        method,
        headers: {
          Authorization: authorization,
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
          Accept: method === 'POST' ? 'text/event-stream' : 'application/json',
        },
        body,
        signal: request.signal,
      });
      if (!upstream.ok) {
        return errorResponse(upstream.status, 'NVIDIA API request failed', allowedOrigin);
      }
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(allowedOrigin),
          'Content-Type': upstream.headers.get('Content-Type') ||
            (method === 'POST' ? 'text/event-stream' : 'application/json'),
        },
      });
    } catch {
      return errorResponse(502, 'NVIDIA API unavailable', allowedOrigin);
    }
  },
};
