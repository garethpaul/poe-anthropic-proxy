# Poe-Anthropic Bridge

A proxy server that bridges between Anthropic's Messages API format and Poe's OpenAI-compatible API.

## Setup

Install dependencies:

```bash
npm install
```

Use Node.js 20 or newer.

Copy the sample environment file and configure your Poe API key:

```bash
cp .env.example .env
```

Required setting:

```env
POE_API_KEY=your_poe_api_key_here
```

Optional settings:

- `POE_BASE_URL` - Poe API base URL. Defaults to `https://api.poe.com`.
- `POE_MODEL` - Default Poe model. The code default is `GPT-4.1`; `.env.example` uses `Claude-Sonnet-4`.
- `PORT` - Server port. Defaults to `3000`.
- `DEBUG` - Enable debug logging with `true`, `1`, `yes`, or `on`.

## Usage

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Quality Gates

Run the deterministic local test suite:

```bash
npm test
```

Check dependency advisories:

```bash
npm run audit
```

Run both local gates together:

```bash
npm run verify
```

These commands run without a Poe API key and without live network calls to Poe.

## Live Verification

After setting `POE_API_KEY` and starting the server, test the proxy manually:

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

## Claude Code

Set `ANTHROPIC_BASE_URL`, then set a model with `/model Grok-4` as an example:

```bash
export ANTHROPIC_BASE_URL=http://0.0.0.0:3000
```
