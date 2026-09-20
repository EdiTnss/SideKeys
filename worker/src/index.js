// SideKeys AI proxy (Cloudflare Worker). It adds the Anthropic key, checks the Origin and
// limits requests per client IP. No music logic and no prompts live here: those are in
// src/ai/ and visible in the repo. The handler takes its upstream `fetch` as an option so the
// whole Worker runs under node --test with a fake env (see test/worker.test.js).
//
// Request body, from src/ai/client.js:
//   { action, system, messages, schema?, maxTokens?, effort? }
// The Worker forwards system/messages/schema/effort to the Messages API, sets the model from
// its own config, caps max_tokens, and returns the API response as is (status included).

import { MAX_BODY_BYTES } from './limits.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;
const EFFORTS = new Set(['low', 'medium', 'high']);
const ROLES = new Set(['user', 'assistant']);
const ACTION = /^[a-z][a-z-]{0,31}$/;

export default {
  fetch: (request, env) => handleRequest(request, env),
};

export async function handleRequest(request, env, { fetch = globalThis.fetch } = {}) {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = allowedOrigins(env).includes(origin);
  const cors = corsHeaders(origin, allowed);

  if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
  if (!allowed) return json({ error: 'origin not allowed' }, 403, cors);
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'proxy not configured' }, 500, cors);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) return json({ error: 'rate limited, try again in a minute' }, 429, cors);

  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return json({ error: 'body too large' }, 413, cors);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'body too large' }, 413, cors);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'body is not valid JSON' }, 400, cors);
  }
  const problem = validate(body);
  if (problem) return json({ error: problem }, 400, cors);

  const started = Date.now();
  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(buildRequest(body, env)),
    });
  } catch (error) {
    console.error(JSON.stringify({ action: body.action, error: 'upstream unreachable', detail: String(error?.message ?? error) }));
    return json({ error: 'upstream unreachable' }, 502, cors);
  }
  const payload = await upstream.text();
  console.log(JSON.stringify({ action: body.action, status: upstream.status, ms: Date.now() - started }));
  return new Response(payload, { status: upstream.status, headers: { ...cors, 'content-type': 'application/json' } });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

function corsHeaders(origin, allowed) {
  if (!allowed) return { vary: 'Origin' };
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'content-type': 'application/json' } });
}

// Returns a problem description, or null when the body is acceptable.
function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be an object';
  if (typeof body.action !== 'string' || !ACTION.test(body.action)) return 'action must be a short lowercase name';
  if (body.system !== undefined && typeof body.system !== 'string') return 'system must be a string';
  if (!Array.isArray(body.messages) || body.messages.length === 0) return 'messages must be a non-empty array';
  for (const message of body.messages) {
    if (!message || !ROLES.has(message.role) || message.content === undefined) return 'each message needs a user/assistant role and content';
  }
  if (body.schema !== undefined && (!body.schema || typeof body.schema !== 'object' || Array.isArray(body.schema))) return 'schema must be an object';
  if (body.maxTokens !== undefined && !(Number.isInteger(body.maxTokens) && body.maxTokens > 0)) return 'maxTokens must be a positive integer';
  if (body.effort !== undefined && !EFFORTS.has(body.effort)) return 'effort must be low, medium or high';
  return null;
}

function buildRequest(body, env) {
  const cap = Number(env.MAX_TOKENS_CAP ?? 8192);
  const request = {
    model: env.MODEL,
    max_tokens: Math.min(body.maxTokens ?? DEFAULT_MAX_TOKENS, cap),
    messages: body.messages,
  };
  if (body.system !== undefined) request.system = body.system;
  const outputConfig = {};
  if (body.schema) outputConfig.format = { type: 'json_schema', schema: body.schema };
  if (body.effort) outputConfig.effort = body.effort;
  if (Object.keys(outputConfig).length > 0) request.output_config = outputConfig;
  return request;
}
