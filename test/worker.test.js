import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as entry from '../worker/src/index.js';
import { handleRequest } from '../worker/src/index.js';

// workerd reads every named export of the entry module as an entrypoint and refuses to start on
// anything that is not a function or a handler (found when MAX_BODY_BYTES was exported from here).
test('the entry module exports only what the Workers runtime accepts: the default handler and functions', () => {
  for (const [name, value] of Object.entries(entry)) {
    if (name === 'default') assert.equal(typeof value.fetch, 'function');
    else assert.equal(typeof value, 'function', `${name} is a ${typeof value}: the Worker would not start`);
  }
});

const PAGES = 'https://editnss.github.io';
const LOCAL = 'http://localhost:3000';

const makeEnv = (overrides = {}) => ({
  ANTHROPIC_API_KEY: 'sk-test-not-a-real-key',
  MODEL: 'claude-opus-5',
  ALLOWED_ORIGINS: `${PAGES},${LOCAL}`,
  MAX_TOKENS_CAP: 8192,
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  ...overrides,
});

const request = (body, { method = 'POST', origin = PAGES, ip = '203.0.113.7', raw } = {}) =>
  new Request('https://proxy.test/', {
    method,
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), 'cf-connecting-ip': ip },
    body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined,
  });

const valid = { action: 'explain', system: 'You are a jazz pianist.', messages: [{ role: 'user', content: 'Cmaj7?' }] };

// A fake upstream: records what the Worker sent and answers with a canned Anthropic-shaped body.
function fakeUpstream({ status = 200, body = { id: 'msg_1', content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn' } } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

test('CORS preflight: allowed origins get the headers, others get 403', async () => {
  const ok = await handleRequest(request(null, { method: 'OPTIONS', origin: LOCAL }), makeEnv());
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), LOCAL);
  assert.match(ok.headers.get('access-control-allow-methods'), /POST/);
  assert.match(ok.headers.get('access-control-allow-headers'), /content-type/i);
  assert.equal(ok.headers.get('vary'), 'Origin');
  const bad = await handleRequest(request(null, { method: 'OPTIONS', origin: 'https://evil.example' }), makeEnv());
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('only POST from an allowed Origin reaches upstream', async () => {
  const { fetch, calls } = fakeUpstream();
  const cases = [
    [request(valid, { origin: 'https://evil.example' }), 403],
    [request(valid, { origin: null }), 403],
    [request(valid, { method: 'GET' }), 405],
  ];
  for (const [req, status] of cases) {
    const res = await handleRequest(req, makeEnv(), { fetch });
    assert.equal(res.status, status, req.method + ' ' + req.headers.get('origin'));
  }
  assert.equal(calls.length, 0);
});

test('rate limit per client IP: the limiter is keyed by CF-Connecting-IP and a refusal is a 429', async () => {
  const keys = [];
  const env = makeEnv({ RATE_LIMITER: { limit: async ({ key }) => { keys.push(key); return { success: key !== '198.51.100.9' }; } } });
  const { fetch, calls } = fakeUpstream();
  const ok = await handleRequest(request(valid, { ip: '203.0.113.7' }), env, { fetch });
  assert.equal(ok.status, 200);
  const limited = await handleRequest(request(valid, { ip: '198.51.100.9' }), env, { fetch });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('access-control-allow-origin'), PAGES);   // errors keep CORS, so the browser can read them
  assert.deepEqual(keys, ['203.0.113.7', '198.51.100.9']);
  assert.equal(calls.length, 1);
});

test('body validation: malformed or oversized requests never reach upstream', async () => {
  const { fetch, calls } = fakeUpstream();
  const env = makeEnv();
  const status = async (req) => (await handleRequest(req, env, { fetch })).status;
  assert.equal(await status(request(null, { raw: '{not json' })), 400);
  assert.equal(await status(request({ action: 'explain', system: 'x' })), 400);                          // no messages
  assert.equal(await status(request({ ...valid, messages: [] })), 400);
  assert.equal(await status(request({ ...valid, messages: [{ role: 'system', content: 'x' }] })), 400);
  assert.equal(await status(request({ ...valid, action: 'Drop Table' })), 400);
  assert.equal(await status(request({ ...valid, effort: 'max' })), 400);
  assert.equal(await status(request({ ...valid, maxTokens: -5 })), 400);
  assert.equal(await status(request({ ...valid, schema: 'not an object' })), 400);
  assert.equal(await status(request({ ...valid, system: 'x'.repeat(70 * 1024) })), 413);
  assert.equal(calls.length, 0);
  const problem = await handleRequest(request({ ...valid, effort: 'max' }), env, { fetch });
  assert.match((await problem.json()).error, /effort/);
});

test('forwarding: the key and model come from the Worker, the prompt and schema from the client', async () => {
  const { fetch, calls } = fakeUpstream();
  const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
  const req = request({ ...valid, schema, maxTokens: 2048, effort: 'medium' });
  const res = await handleRequest(req, makeEnv(), { fetch });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), PAGES);
  assert.deepEqual(await res.json(), { id: 'msg_1', content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn' });

  assert.equal(calls.length, 1);
  const [{ url, init, body }] = calls;
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-api-key'], 'sk-test-not-a-real-key');
  assert.equal(init.headers['anthropic-version'], '2023-06-01');
  assert.equal(body.model, 'claude-opus-5');
  assert.equal(body.max_tokens, 2048);
  assert.equal(body.system, valid.system);
  assert.deepEqual(body.messages, valid.messages);
  assert.deepEqual(body.output_config, { format: { type: 'json_schema', schema }, effort: 'medium' });
  assert.equal('thinking' in body, false);                                   // adaptive by default on this model
  assert.equal('action' in body, false);                                     // the action is for logs only
});

test('max_tokens is capped by the Worker and defaults when omitted; no schema means no format', async () => {
  const { fetch, calls } = fakeUpstream();
  await handleRequest(request({ ...valid, maxTokens: 100000 }), makeEnv(), { fetch });
  await handleRequest(request(valid), makeEnv(), { fetch });
  assert.equal(calls[0].body.max_tokens, 8192);
  assert.equal(calls[1].body.max_tokens, 4096);
  assert.equal('output_config' in calls[1].body, false);
});

test('upstream errors are passed through with their status; a dead upstream is a 502; a missing key is a 500', async () => {
  const over = fakeUpstream({ status: 429, body: { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } } });
  const res = await handleRequest(request(valid), makeEnv(), { fetch: over.fetch });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error.type, 'rate_limit_error');

  const dead = await handleRequest(request(valid), makeEnv(), { fetch: async () => { throw new TypeError('fetch failed'); } });
  assert.equal(dead.status, 502);

  const { fetch, calls } = fakeUpstream();
  const unconfigured = await handleRequest(request(valid), makeEnv({ ANTHROPIC_API_KEY: undefined }), { fetch });
  assert.equal(unconfigured.status, 500);
  assert.equal(calls.length, 0);
  assert.doesNotMatch(await unconfigured.text(), /sk-/);
});
