import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, AiError } from '../src/ai/client.js';

const reply = (body, status = 200) => async () => new Response(JSON.stringify(body), { status });
const message = (text, extra = {}) => ({
  id: 'msg_1', model: 'claude-opus-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 }, ...extra,
});
const options = { system: 'sys', messages: [{ role: 'user', content: 'hi' }], schema: { type: 'object' }, maxTokens: 1024, effort: 'low' };

test('sends the prompt to the proxy and returns the parsed JSON with model and usage', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(message('{"voicings":[]}')), { status: 200 }); };
  const client = createClient({ baseUrl: 'https://proxy.test/', fetch });
  const result = await client.call('explain', options);
  assert.deepEqual(result, { data: { voicings: [] }, model: 'claude-opus-5', usage: { input_tokens: 10, output_tokens: 5 } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://proxy.test/');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { action: 'explain', ...options });
});

test('every failure becomes an AiError with a kind the UI can show', async () => {
  const kindOf = async (fetch, baseUrl = 'https://proxy.test/') => {
    try {
      await createClient({ baseUrl, fetch }).call('explain', options);
      return 'none';
    } catch (error) {
      assert.ok(error instanceof AiError, String(error));
      return error.kind;
    }
  };
  assert.equal(await kindOf(reply({}), ''), 'not-configured');
  assert.equal(await kindOf(async () => { throw new TypeError('Failed to fetch'); }), 'network');
  assert.equal(await kindOf(reply({ error: 'origin not allowed' }, 403)), 'forbidden');
  assert.equal(await kindOf(reply({ error: 'rate limited' }, 429)), 'rate-limited');
  assert.equal(await kindOf(reply({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, 529)), 'upstream');
  assert.equal(await kindOf(async () => new Response('<html>bad gateway</html>', { status: 502 })), 'upstream');
  assert.equal(await kindOf(reply(message('', { stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'declined' } }))), 'refusal');
  assert.equal(await kindOf(reply(message('{"voi', { stop_reason: 'max_tokens' }))), 'truncated');
  assert.equal(await kindOf(reply(message('not json at all'))), 'invalid-json');
  assert.equal(await kindOf(reply(message('', { content: [] }))), 'invalid-json');
});

test('error messages come from the proxy or from the API error body, with the status attached', async () => {
  const failing = async (body, status) => createClient({ baseUrl: 'https://proxy.test/', fetch: reply(body, status) }).call('explain', options).catch(e => e);
  const proxy = await failing({ error: 'proxy not configured' }, 500);
  assert.equal(proxy.kind, 'upstream');
  assert.equal(proxy.message, 'proxy not configured');
  assert.equal(proxy.status, 500);
  const api = await failing({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401);
  assert.equal(api.message, 'invalid x-api-key');
  assert.equal(api.status, 401);
  const refusal = await failing(message('', { stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'declined' } }), 200);
  assert.equal(refusal.message, 'declined');
});
