# LifeOS - Phase 1

Personal life management system built with TypeScript, Express, Vue 3, and SQLite.

This project now lives inside the LifeOnline monorepo at `LifeOnline/LifeOS`.

## Project Structure

```
LifeOS/
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── server/          # Express backend + SQLite indexer
│   └── web/             # Vue 3 frontend
└── mock-vault/          # Sample Obsidian vault data
```

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Initialize Database

```bash
pnpm db:init
```

### Index Mock Vault

```bash
pnpm index
```

### Development

Start both server and web frontend:

```bash
pnpm dev
```

- Server: http://localhost:3000
- Frontend: http://localhost:5173

### Individual Commands

```bash
# Start server only
pnpm --filter server dev

# Start web only
pnpm --filter web dev

# Re-index vault
pnpm index
```

## API Endpoints

- `GET /api/dashboard` - Get dashboard data (today's todos, weekly highlights, dimension stats)
- `GET /api/notes?dimension=health&status=pending` - Query notes with filters
- `POST /api/index` - Trigger manual re-indexing

## Features

✅ Vault indexing service (scans markdown files with frontmatter)
✅ SQLite database with full schema
✅ REST API for dashboard data
✅ Vue 3 dashboard with:
  - Today's todos
  - Weekly highlights
  - Eight-dimension health cards

## Mock Vault

The `mock-vault/` directory contains 25 sample markdown files across 8 life dimensions:
- 健康 (Health)
- 事业 (Career)
- 财务 (Finance)
- 学习 (Learning)
- 关系 (Relationship)
- 生活 (Life)
- 兴趣 (Hobby)
- 成长 (Growth)

## Next Steps

- Connect to real Obsidian vault (set `VAULT_PATH` environment variable)
- Add authentication
- Implement note editing
- Add search functionality
- Mobile responsive design
