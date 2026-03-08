# Duet

Collaborative AI sessions where multiple people share a live context and get responses calibrated to how they think.

AI conversations today are single-player. One person, one thread, one context window. When teams try to use AI together, the workflow breaks down: screenshots in Slack, lost context, generic responses regardless of role. Duet fixes this by putting everyone in the same AI conversation with shared context and - eventually - personalized output per participant.

## How it works

1. Create a session and share the invite link
2. Both participants join over WebSocket
3. Messages from all participants feed into a single AI context
4. The AI streams its response to everyone in real time, aware of who is in the room

The AI sees everything both people contribute and addresses participants by name. Every message is clearly attributed to its sender.

## Architecture

```
User A                          User B
  |                               |
  +----------- WebSocket ---------+
                    |
              Session Server
                    |
         +----------+----------+
    Context Store          LLM Pipeline
    (shared, neutral)      (bring your own key)
         +----------+----------+
                    |
          Fan-out via WebSocket
```

- **Monorepo** with pnpm workspaces: `@duet/server`, `@duet/client`, `@duet/shared`
- **Server**: Node.js + Fastify, WebSocket via `ws`, Bull + Redis for job queuing
- **Client**: React Router v7 (framework mode) + TypeScript, Zustand for session state
- **Database**: SQLite for sessions and messages
- **LLM**: Bring your own API key. Ships with Anthropic Claude support, designed to be provider-agnostic

## Getting started

### Prerequisites

- Node.js 24+
- pnpm

### Setup

```bash
git clone https://github.com/joelfickson/duet.git
cd duet
pnpm install
```

### Configuration

Copy the example environment file and add your LLM API key:

```bash
cp .env.example .env
```

```
LLM_API_KEY=your-key-here
```

### Run

```bash
# Start the server
pnpm --filter @duet/server dev

# Start the client
pnpm --filter @duet/client dev
```

## Project structure

```
packages/
  server/    - WebSocket server, session management, LLM pipeline
  client/    - React Router v7 frontend
  shared/    - Shared TypeScript types
```

## Roadmap

The MVP delivers the core experience: two people, one AI, one shared conversation with real-time streaming.

**MVP (current focus)**
- Auth via Clerk (email + Google OAuth)
- Session creation and invite links
- Shared WebSocket rooms with presence
- Shared AI context with participant names
- Live streaming to all participants
- Message attribution and persistence

**Post-MVP**
- Personality profiles and personalized responses per participant
- Behavioral inference from interaction patterns
- Response delta comparison view
- Support for more than two participants
- Self-hosted Docker Compose distribution
- Mobile-responsive experience

## License

MIT
