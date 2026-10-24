import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import worker from './index.js';

const origin = 'https://hyangdan2.github.io';
const env = { ALLOWED_ORIGIN: origin };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('answers browser preflight only for the allowed origin and route', async () => {
  const allowed = await worker.fetch(new Request('https://proxy.example/v1/chat/completions', {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
  }), env);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), origin);
  assert.match(allowed.headers.get('Access-Control-Allow-Headers'), /Authorization/);

  const blocked = await worker.fetch(new Request('https://proxy.example/v1/chat/completions', {
    method: 'OPTIONS',
    headers: { Origin: 'https://other.example', 'Access-Control-Request-Method': 'POST' },
  }), env);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.get('Access-Control-Allow-Origin'), null);
});

test('forwards only the fixed NVIDIA chat route and keeps the response streaming', async () => {
  const chunks = ['data: {"choices":[{"delta":{"content":"안"}}]}\n\n', 'data: [DONE]\n\n'];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer YOUR_API_KEY');
    assert.equal(JSON.parse(new TextDecoder().decode(options.body)).model, 'example/model');
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(chunks[0]));
        controller.enqueue(new TextEncoder().encode(chunks[1]));
        controller.close();
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } });
  };

  const response = await worker.fetch(new Request('https://proxy.example/v1/chat/completions', {
    method: 'POST',
    headers: { Origin: origin, Authorization: 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'example/model' }),
  }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
  assert.equal(await response.text(), chunks.join(''));

  const unknown = await worker.fetch(new Request('https://proxy.example/v1/other', {
    headers: { Origin: origin, Authorization: 'Bearer YOUR_API_KEY' },
  }), env);
  assert.equal(unknown.status, 404);
});

test('does not return sensitive upstream error bodies', async () => {
  globalThis.fetch = async () => new Response('secret upstream detail', { status: 401 });
  const response = await worker.fetch(new Request('https://proxy.example/v1/models', {
    headers: { Origin: origin, Authorization: 'Bearer YOUR_API_KEY' },
  }), env);
  assert.equal(response.status, 401);
  assert.equal(await response.text(), 'NVIDIA API request failed');
});
