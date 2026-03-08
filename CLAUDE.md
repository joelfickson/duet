# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Duet is a collaborative AI session platform - multiple participants share a live AI context over WebSocket with real-time streaming. Open core under MIT license. The product blueprint lives in `synaptic_blueprint_v1.1.docx` and implementation specs are in `issues/` (45 sequential tickets).

## Architecture

pnpm workspace monorepo with three packages:

- `@duet/server` (packages/server) - Fastify + @fastify/websocket, LLM streaming (ships with Anthropic, designed to be provider-agnostic), better-sqlite3 for persistence, Bull + Redis for job queuing
- `@duet/client` (packages/client) - React Router v7 (framework mode), Zustand for session state, native WebSocket API
- `@duet/shared` (packages/shared) - TypeScript types only (WebSocket events, Message, Session, Participant)

The server manages WebSocket rooms where participants connect. Messages from all participants merge into a single AI context. The AI response streams to all connected clients via fan-out. SQLite stores sessions and messages locally; PostgreSQL is planned for cloud.

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm --filter @duet/server dev
pnpm --filter @duet/client dev

# Build
pnpm --filter @duet/server build
pnpm --filter @duet/client build

# Lint and format (Biome - single tool, no ESLint/Prettier)
pnpm check          # lint + format combined
pnpm lint
pnpm format

# Type checking
pnpm typecheck

# Tests (Vitest)
pnpm test                          # all packages
pnpm --filter @duet/server test    # server only
pnpm --filter @duet/client test    # client only

# Docker
docker compose up
```

## Key conventions

- **Biome** for all linting and formatting - no ESLint, no Prettier
- **Vitest** for all testing
- **pnpm** only - no npm or yarn
- **TypeScript strict mode** everywhere, extending `tsconfig.base.json` at root
- Shared types go in `@duet/shared` - both server and client depend on it
- Server port 3001, client port 3000
- Environment: `LLM_API_KEY` (required), `DATABASE_PATH` (default `./data/duet.db`), `PORT`, `VITE_WS_URL`, `VITE_API_URL`

## Issue specs

The `issues/` directory contains 45 numbered specs in dependency order (001-045). Each has type, priority, dependencies, description, and acceptance criteria. Start from the lowest unimplemented number whose dependencies are met.
