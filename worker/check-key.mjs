// Checks the Anthropic key without spending anything and without ever printing it:
// it lists the models the key can reach, which both proves the key works and shows whether
// the account has the model this Worker is configured to use.
//
//   npm run check-key           (reads worker/.dev.vars)
//
// Nothing here runs in the Worker; it is a local convenience script.

import { readFileSync } from 'node:fs';

const VARS = new URL('./.dev.vars', import.meta.url);
const CONFIG = new URL('./wrangler.jsonc', import.meta.url);

function readKey() {
  let text;
  try {
    text = readFileSync(VARS, 'utf8');
  } catch {
    fail('There is no worker/.dev.vars yet. Copy .dev.vars.example to .dev.vars and paste your key after the "=".');
  }
  const line = text.split(/\r?\n/).find(row => row.trim().startsWith('ANTHROPIC_API_KEY='));
  if (!line) fail('worker/.dev.vars has no ANTHROPIC_API_KEY line. Copy the one from .dev.vars.example.');
  const value = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  if (!value) fail('The key in worker/.dev.vars is empty. Paste it after the "=", with no spaces and no quotes.');
  return value;
}

function configuredModel() {
  try {
    return readFileSync(CONFIG, 'utf8').match(/"MODEL"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const key = readKey();
const model = configuredModel();

const response = await fetch('https://api.anthropic.com/v1/models', {
  headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
}).catch(error => fail(`Could not reach the Anthropic API: ${error.message}`));

const body = await response.json().catch(() => null);

if (response.status === 401) fail('The key was rejected (401). Check that you pasted the whole key, or create a new one in the Anthropic console.');
if (response.status === 400 && /credit|billing/i.test(body?.error?.message ?? '')) {
  fail(`The key is valid but the account cannot be used yet: ${body.error.message}`);
}
if (!response.ok) fail(`The API answered ${response.status}: ${body?.error?.message ?? 'unknown error'}`);

const ids = (body?.data ?? []).map(entry => entry.id);
console.log(`Key works. ${ids.length} models available.`);
if (model && !ids.includes(model)) {
  console.log(`Note: this Worker is set to "${model}", which is not in the list. Change MODEL in wrangler.jsonc to one of: ${ids.slice(0, 5).join(', ')}`);
} else if (model) {
  console.log(`"${model}" is available, which is what this Worker uses.`);
}
