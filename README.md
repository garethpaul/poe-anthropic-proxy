# Poe-Anthropic Bridge

A proxy server that bridges between Anthropic's Messages API format and Poe's OpenAI-compatible API.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment file and configure:

```bash
cp .env.example .env
```

3. Edit `.env` and add your Poe API key:

```env
POE_API_KEY=your_poe_api_key_here
```

## Usage

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Testing

Test the proxy:

```bash
npm test
```

Or manually:

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

## Environment Variables

- `POE_API_KEY` - Your Poe API key (required)
- `POE_BASE_URL` - Poe API base URL (default: https://api.poe.com)
- `POE_MODEL` - Default model to use (default: Claude-3-5-Sonnet)
- `PORT` - Server port (default: 3000)
- `DEBUG` - Enable debug logging (default: false)

## Claude Code

Set the ANTHROPIC_BASE_URL and then set a model with `/model Grok-4` as an example

`export ANTHROPIC_BASE_URL=http://0.0.0.0:3000`
