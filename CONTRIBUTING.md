# Contributing to Duet

## Prerequisites

- Node.js 24+
- pnpm (`npm install -g pnpm`)

## Setup

```bash
git clone https://github.com/joelfickson/duet.git
cd duet
pnpm install
```

## Development

```bash
pnpm --filter @duet/server dev    # start server
pnpm --filter @duet/client dev    # start client
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
pnpm --filter @duet/client test    # client only
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
