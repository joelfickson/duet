# Duet

Collaborative AI sessions - multiple participants, one shared context, real-time streaming.

AI conversations today are single-player. Duet puts everyone in the same AI conversation. Messages from all participants feed into a single context, and the AI streams its response to everyone simultaneously.

## How it works

1. Create a session and share the invite link
2. Participants join over WebSocket
3. All messages feed into a single AI context
4. The AI streams its response to everyone in real time

The AI sees everything every participant contributes and addresses people by name.

## Quick start

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
git clone https://github.com/joelfickson/joinduet.git
cd joinduet
pnpm install
```

### Configuration

Set your LLM provider API key. At least one is required:

```bash
# Anthropic (default)
export ANTHROPIC_API_KEY=sk-ant-...

# Or Google Gemini
export GEMINI_API_KEY=AIza...

# Or OpenRouter (has free models)
export OPENROUTER_API_KEY=sk-or-...
```

Or use BYOK - provide your API key when creating a session in the UI.

### Run

```bash
# Start both server and client
pnpm dev

# Or separately
pnpm --filter @duet/server dev   # Server on :8000
pnpm --filter @duet/client dev   # Client on :8001
```

Open http://localhost:8001, create a session, share the invite link.

## Architecture

```
Participant A                 Participant B
      |                             |
      +---------- WebSocket --------+
                      |
                Session Server
                      |
           +----------+----------+
      Context Store          LLM Pipeline
      (shared, neutral)      (multi-provider)
           +----------+----------+
                      |
            Fan-out via WebSocket
```

### Monorepo structure

```
packages/
  server/    @duet/server   Fastify + WebSocket, LLM streaming, SQLite
  client/    @duet/client   React Router v7, Zustand, native WebSocket
  shared/    @duet/shared   TypeScript types (events, messages, sessions)
```

### LLM providers

Ships with three providers, selectable per session:

| Provider | Default model | Notes |
|----------|--------------|-------|
| Anthropic | Claude Sonnet 4 | Best quality |
| Gemini | Gemini 2.5 Flash | Fast, good value |
| OpenRouter | Llama 3.1 8B | Free models available |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `GEMINI_API_KEY` | - | Google Gemini API key |
| `OPENROUTER_API_KEY` | - | OpenRouter API key |
| `PORT` | `8000` | Server port |
| `DATABASE_PATH` | `./data/duet.db` | SQLite database path |
| `VITE_API_URL` | `http://localhost:8000` | API URL for client |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket URL for client |
| `RATE_LIMIT_MAX` | `30` | Max messages per window |
| `RATE_LIMIT_WINDOW_MS` | `10000` | Rate limit window (ms) |
| `RECONNECT_GRACE_MS` | `60000` | Reconnection grace period (ms) |

## Development

```bash
# Install dependencies
pnpm install

# Run dev servers (both)
pnpm dev

# Lint + format (Biome)
pnpm check

# Type checking
pnpm typecheck

# Tests
pnpm test
```

## Tech stack

- **Runtime**: Node.js + TypeScript (strict mode)
- **Server**: Fastify, @fastify/websocket, better-sqlite3
- **Client**: React Router v7 (framework mode), Zustand, TanStack Query
- **LLM**: Anthropic SDK, Google GenAI SDK, OpenAI SDK (OpenRouter)
- **Tooling**: Biome (lint + format), Vitest (tests), pnpm workspaces

## Cloud version

The hosted version at [joinduet.ai](https://joinduet.ai) adds authentication, private sessions, persistent history, and higher usage limits. This open-source version is the core engine - ephemeral sessions, no auth, BYOK.

## License

MIT
