# AI Code Editor Monorepo

This repository contains two independent projects:

- `frontend/` React + Vite + TypeScript + Tailwind CSS
- `backend/` Bun + Express + TypeScript

## Initialization Commands

```bash
# 1) Scaffold projects
bun create vite frontend --template react-ts
bun init -y backend

# 2) Install dependencies
cd frontend && bun install
cd ../backend && bun install

# 3) Run quality checks
cd ../frontend && bun run typecheck && bun run lint && bun run build
cd ../backend && bun run typecheck && bun run lint && bun run build

# 4) Start apps
cd ../frontend && bun run dev
cd ../backend && bun run dev
```

## Environment Setup

- Backend: copy `backend/.env.example` to `backend/.env`
- Frontend: copy `frontend/.env.example` to `frontend/.env`

No credentials are hardcoded.
