# Backend

Node.js-compatible backend foundation running on Bun with TypeScript strict mode.

## Commands

```bash
bun install
bun run dev
```

## Structure

- `src/config` environment setup and runtime config
- `src/api` route registration and versioned HTTP surface
- `src/modules` feature modules (starts with `health`)
- `src/modules/ai` AI infrastructure (provider/prompt/context/response/model registry/logging + placeholder endpoints)
- `src/infrastructure/database` PostgreSQL + Neon client factories
- `src/infrastructure/llm` LLM provider contracts
- `src/infrastructure/websocket` WebSocket gateway setup
- `src/infrastructure/indexing` file-indexing contracts
- `src/infrastructure/analysis` code-analysis contracts
- `src/shared` common types and utilities

Copy `.env.example` to `.env` and provide real values as needed.
