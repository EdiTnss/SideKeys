// The only path to Claude: browser → Cloudflare Worker (worker/) → Anthropic Messages API.
// The Worker adds the key and the model; this client sends the prompt and turns every failure
// into an AiError with a `kind` the UI can show in one line. Answers are JSON by construction
// (structured outputs), so the parsed object comes back directly.
//
// `fetch` is injectable so the client runs under node --test with a fake proxy.

export const ERROR_KINDS = ['not-configured', 'network', 'forbidden', 'rate-limited', 'upstream', 'refusal', 'truncated', 'invalid-json'];

export class AiError extends Error {
  constructor(kind, message, { status = null, detail = null } = {}) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

/**
 * createClient({ baseUrl, fetch }) → { baseUrl, call(action, { system, messages, schema, maxTokens, effort }) }
 * call resolves to { data, model, usage } or rejects with an AiError.
 */
export function createClient({ baseUrl = '', fetch = globalThis.fetch } = {}) {
  return {
    baseUrl,
    async call(action, { system, messages, schema, maxTokens, effort } = {}) {
      if (!baseUrl) throw new AiError('not-configured', 'Set the AI proxy URL in Settings first.');
      let response;
      try {
        response = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, system, messages, schema, maxTokens, effort }),
        });
      } catch (error) {
        throw new AiError('network', 'Could not reach the AI proxy.', { detail: String(error?.message ?? error) });
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new AiError(kindFor(response.status), messageFrom(payload, response.status), { status: response.status, detail: payload });
      }
      if (!payload || typeof payload !== 'object') {
        throw new AiError('upstream', 'Unreadable answer from the AI proxy.', { status: response.status });
      }
      if (payload.stop_reason === 'refusal') {
        throw new AiError('refusal', payload.stop_details?.explanation || 'The model declined this request.', { detail: payload.stop_details ?? null });
      }
      if (payload.stop_reason === 'max_tokens') {
        throw new AiError('truncated', 'The answer was cut off before it was complete.');
      }
      const text = Array.isArray(payload.content) ? payload.content.find(block => block.type === 'text')?.text : undefined;
      if (typeof text !== 'string') throw new AiError('invalid-json', 'The answer has no text.');
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new AiError('invalid-json', 'The answer is not valid JSON.', { detail: text.slice(0, 200) });
      }
      return { data, model: payload.model ?? null, usage: payload.usage ?? null };
    },
  };
}

function kindFor(status) {
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate-limited';
  return 'upstream';
}

// The proxy answers { error: "text" }; the Anthropic API answers { error: { type, message } }.
function messageFrom(payload, status) {
  const error = payload?.error;
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  return `The AI proxy answered with status ${status}.`;
}
