# Voicing Lab AI proxy

A Cloudflare Worker that stands between the browser app and the Anthropic API. It adds the API
key, checks the `Origin`, limits requests per IP and caps `max_tokens`. It holds no music logic
and no prompts: those live in `src/ai/` in the main app, in the open.

The key is never in this repo and never in the browser. Locally it lives in `.dev.vars`, which
git ignores; in the cloud it is a Wrangler secret, stored by Cloudflare.

## Setup, once

**1. Get an Anthropic key.** At [console.anthropic.com](https://console.anthropic.com), add a
little prepaid credit under Billing, then Settings → API keys → Create key. The key is shown
once, so put it in a password manager straight away.

**2. Put it in `.dev.vars`.** The file already exists next to this one with an empty value.
Open it and paste the key after the `=`, with no spaces and no quotes:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**3. Check it.** This lists the models the key can reach. It costs nothing, and it never prints
the key:

```
npm run check-key
```

**4. Run the Worker locally.**

```
npm run dev
```

It serves on `http://127.0.0.1:8787`. Paste that address into the app's Settings → AI (Ask
Claude) → Proxy URL, then try **Ask Claude** in the drill or **Reharmonize** in the Reharm tab.

## Publishing

```
npx wrangler login
```

```
npm run deploy
```

Deploy prints the public address, something like
`https://voicing-lab-proxy.<account>.workers.dev`. Then store the key in Cloudflare, which
redeploys the Worker with it:

```
npm run secret
```

Paste that public address into the app's Settings instead of the local one. `ALLOWED_ORIGINS`
in `wrangler.jsonc` already covers `https://editnss.github.io` and localhost, so the deployed
app and local development both work; no other site can use the Worker.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the Worker locally on port 8787 |
| `npm run check-key` | Says whether the key in `.dev.vars` works |
| `npm run check` | Builds and validates the config without deploying |
| `npm run deploy` | Publishes the Worker |
| `npm run secret` | Stores `ANTHROPIC_API_KEY` in Cloudflare |

The Worker's own tests run with the main suite, from the repo root: `npm test` covers the
`Origin` check, the per-IP limit, body validation and what gets forwarded, all without a key.

## Costs and limits

`MODEL` and `MAX_TOKENS_CAP` are in `wrangler.jsonc`. The rate limit is 20 requests per minute
per IP, which is what stops a visitor from draining the key once the app is public. A prepaid
spend limit in the Anthropic console is the other half of that belt.
