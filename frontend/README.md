# Byaboneka+ Frontend

React 18 + TypeScript + Vite + Tailwind CSS SPA.

## Setup

```bash
cp .env.example .env          # Set VITE_API_URL
npm install
npm run dev                    # http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Deployment

**Vercel:** Set root to `frontend`, add `VITE_API_URL` env var.  
**Docker:** `docker build --build-arg VITE_API_URL=https://api.example.com/api/v1 -t byaboneka-frontend .`

## Key Libraries

- **Zustand** — State management (auth store with persistence)
- **React Router 6** — Client-side routing with guards
- **Axios** — HTTP client with interceptors and token refresh
- **Lucide React** — Icon library
- **react-hot-toast** — Notifications
- **date-fns** — Date formatting
