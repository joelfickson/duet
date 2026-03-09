# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Multi-participant AI sessions over WebSocket with real-time streaming
- LLM provider abstraction: Anthropic, Gemini, OpenRouter (selectable per session)
- BYOK (Bring Your Own Key) support via session creation UI
- Message reply feature with inline reply context
- Message history delivered to participants joining an existing session
- AI re-trigger when new messages arrive during active streaming
- Reconnection with grace period and missed message replay
- Typing indicators and presence tracking
- Rate limiting per connection
- SQLite persistence for sessions and messages
- Markdown rendering for AI responses (GFM support)
- Responsive UI with dark theme
