# Local Development Setup (Without Docker)

This guide helps you run Byaboneka+ locally without Docker.

## Prerequisites

1. **Node.js 18+** - Download from https://nodejs.org
2. **PostgreSQL 15+** - Download from https://www.postgresql.org/download/

## Step 1: Setup PostgreSQL Database

### Option A: Using pgAdmin or psql
```sql
-- Create database and user
CREATE USER byaboneka WITH PASSWORD 'byaboneka_dev_pass';
CREATE DATABASE byaboneka_plus OWNER byaboneka;
GRANT ALL PRIVILEGES ON DATABASE byaboneka_plus TO byaboneka;
```

### Option B: Using command line (Windows)
```powershell
# Open psql as postgres user
psql -U postgres

# Then run:
CREATE USER byaboneka WITH PASSWORD 'byaboneka_dev_pass';
CREATE DATABASE byaboneka_plus OWNER byaboneka;
\q
```

## Step 2: Configure Backend

```powershell
cd backend

# Copy environment file
cp .env.example .env

# Edit .env file - update DATABASE_URL if needed:
# DATABASE_URL=postgresql://byaboneka:byaboneka_dev_pass@localhost:5432/byaboneka_plus
```

Your `.env` should look like:
```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://byaboneka:byaboneka_dev_pass@localhost:5432/byaboneka_plus
JWT_SECRET=dev_jwt_secret_change_in_production_min_32_chars
JWT_REFRESH_SECRET=dev_refresh_secret_change_in_production_min_32
CORS_ORIGIN=http://localhost:3000
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Step 3: Install Dependencies & Run Backend

```powershell
cd backend

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed test data (optional but recommended)
npm run seed

# Start backend server
npm run dev
```

Backend will be running at: http://localhost:4000/api/v1

Test it: http://localhost:4000/api/v1/health

## Step 4: Setup Frontend

```powershell
# Open new terminal
cd frontend

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start frontend
npm run dev
```

Frontend will be running at: http://localhost:3000

## Step 5: Test Login

Use these test accounts (after running seeds):

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@byaboneka.rw | Admin@123 |
| Coop Staff | staff1@kigalimoto.rw | User@123 |
| Citizen | emmanuel.k@gmail.com | User@123 |

## Troubleshooting

### Database Connection Error
- Make sure PostgreSQL is running
- Check the DATABASE_URL in .env matches your PostgreSQL setup
- Try connecting with psql: `psql -U byaboneka -d byaboneka_plus`

### Port Already in Use
- Backend: Change PORT in backend/.env
- Frontend: Use `npm run dev -- --port 3001`

### Module Not Found
```powershell
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

### Migration Failed
```powershell
# Rollback and retry
npm run rollback
npm run migrate
```
