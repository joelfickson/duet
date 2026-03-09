# Contributing to Duet

Thanks for your interest in contributing. This guide covers setup and conventions.

## Prerequisites

- Node.js 24+
- pnpm 9+ (`npm install -g pnpm`)

## Setup

```bash
git clone https://github.com/joelfickson/joinduet.git
cd joinduet
pnpm install
cp .env.example .env  # then add your API key(s)
```

## Development

```bash
pnpm dev                             # start both server and client
pnpm --filter @duet/server dev       # server only (:8000)
pnpm --filter @duet/client dev       # client only (:8001)
```

## Code quality

Duet uses **Biome** as the single tool for linting and formatting. No ESLint or Prettier.

```bash
pnpm check       # lint + format (combined)
pnpm lint        # lint only
pnpm format      # format only
pnpm typecheck   # TypeScript type checking
```

## Tests

```bash
pnpm test                          # all packages
pnpm --filter @duet/server test    # server only
```

## Branch conventions

- Branch from `master`
- Use `feat/`, `fix/`, `chore/` prefixes: `feat/012-invite-links`, `fix/session-cleanup`
- Keep PRs focused on a single issue

## Commit messages

Follow conventional commits:

```
feat(server): add WebSocket connection handler
fix: resolve session cleanup on disconnect
chore: update dependencies
docs: add API documentation
```

Keep the first line under 100 characters.

## Pull requests

- Fill out the PR template
- Make sure CI passes (`pnpm check`, `pnpm typecheck`, `pnpm test`)
- Keep changes focused - one feature or fix per PR
