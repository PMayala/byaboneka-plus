# Byaboneka+ Backend API

Express + TypeScript REST API with PostgreSQL.

## Setup

```bash
cp .env.example .env          # Configure database & JWT secrets
npm install
npm run dev                    # http://localhost:4000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot-reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run seed` | Load demo data |
| `npm test` | Run all tests |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests (needs DB) |
| `npm run test:coverage` | Tests with coverage report |

## Database

Migrations run automatically on server start. To reset:

```bash
npm run migrate:down   # Drop all tables
npm run dev            # Recreates everything
npm run seed           # Optional: load demo data
```

## Architecture

- **Controllers** handle HTTP request/response
- **Services** contain business logic
- **Middleware** handles auth, validation, rate limiting, error handling
- **Migrations** are idempotent (safe to re-run)

## Environment Variables

See `.env.example` for all required variables.
