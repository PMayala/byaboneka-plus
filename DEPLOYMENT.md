# Byaboneka+ Deployment Guide

## Option A: Render (Backend) + Vercel (Frontend)

This is the recommended approach for the capstone demo.

### Step 1: Deploy Backend to Render

1. **Create a Render account** at https://render.com
2. **Create a PostgreSQL database:**
   - Dashboard → New → PostgreSQL
   - Name: `byaboneka-db`
   - Plan: Free (sufficient for demo)
   - Copy the **Internal Database URL**
3. **Create a Web Service:**
   - Dashboard → New → Web Service
   - Connect your GitHub repo
   - Settings:
     - **Root Directory:** `backend`
     - **Build Command:** `npm ci && npm run build`
     - **Start Command:** `node dist/index.js`
   - Environment variables:
     ```
     NODE_ENV=production
     DATABASE_URL=<your-render-postgres-internal-url>
     JWT_SECRET=<generate: openssl rand -hex 32>
     JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>
     JWT_ACCESS_EXPIRY=15m
     JWT_REFRESH_EXPIRY=7d
     CORS_ORIGIN=https://your-app.vercel.app
     UPLOAD_PATH=./uploads
     BREVO_SMTP_HOST=smtp-relay.brevo.com
     BREVO_SMTP_PORT=587
     BREVO_SMTP_USER=a294a1001@smtp-brevo.com
     BREVO_SMTP_KEY=<your-brevo-smtp-master-password>
     EMAIL_FROM=Byaboneka+ <noreply@byaboneka.rw>
     FRONTEND_URL=https://your-app.vercel.app
     ```
4. **Deploy.** Render will build and start your API.
5. **Note the API URL** (e.g., `https://byaboneka-api.onrender.com`)

### Step 2: Seed Demo Data (Optional)

```bash
# SSH into Render shell or use the Render console
npm run seed
```

### Step 3: Deploy Frontend to Vercel

1. **Create a Vercel account** at https://vercel.com
2. **Import your GitHub repo**
3. **Settings:**
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
4. **Environment variables:**
   ```
   VITE_API_URL=https://byaboneka-api.onrender.com/api/v1
   ```
5. **Deploy.** Vercel will build and deploy.

### Step 4: Update CORS

Go back to Render and update `CORS_ORIGIN` to include your Vercel URL:
```
CORS_ORIGIN=https://byaboneka-plus.vercel.app
```

---

## Option B: Docker Self-Hosted

For running everything on a single server (VPS, cloud VM, etc.)

### Step 1: Prerequisites
- Docker + Docker Compose installed
- Domain name pointing to your server (optional but recommended)

### Step 2: Configure

```bash
cp .env.example .env
nano .env   # Fill in all values
```

**Important:** Generate strong JWT secrets:
```bash
openssl rand -hex 32   # For JWT_SECRET
openssl rand -hex 32   # For JWT_REFRESH_SECRET
```

### Step 3: Deploy

```bash
docker compose -f docker-compose.production.yml up -d --build
```

### Step 4: Verify

```bash
# Check all services are running
docker compose -f docker-compose.production.yml ps

# Check API health
curl http://localhost:4000/api/v1/health

# Check frontend
curl http://localhost
```

### Step 5: Seed Demo Data (Optional)

```bash
docker exec -it $(docker ps -qf "name=api") npm run seed
```

---

## SSL/HTTPS (Production)

For production with Docker, add a reverse proxy with SSL:

1. **Cloudflare** (easiest): Point domain to your server, enable Full SSL
2. **Caddy** (self-hosted): Add a Caddy container to docker-compose
3. **Let's Encrypt + nginx**: Use certbot with the nginx container

---

## 📧 Brevo Email Setup (Required for password reset, notifications)

Byaboneka+ uses [Brevo](https://www.brevo.com) (formerly Sendinblue) for transactional emails. Free tier provides 300 emails/day — more than enough for MVP.

### Step 1: Create Brevo Account
1. Sign up at https://www.brevo.com (free)
2. Complete email verification

### Step 2: Get SMTP Credentials
1. Go to **Settings** → **SMTP & API** → **SMTP Settings**
2. Note your credentials:
   - **SMTP Server:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Login:** Your Brevo account email
   - **Master Password:** Click "Generate" to create one

### Step 3: Configure Environment
Add to your `.env`:
```
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=a294a1001@smtp-brevo.com
BREVO_SMTP_KEY=your_generated_master_password
EMAIL_FROM=Byaboneka+ <noreply@byaboneka.rw>
FRONTEND_URL=https://your-frontend-url.com
```

### Step 4: Verify
Check the health endpoint after deployment:
```bash
curl https://your-api-url/api/v1/health
# Should show: "email": { "configured": true, "connected": true, "provider": "brevo" }
```

### Emails Sent By Byaboneka+
| Trigger | Email Type | Recipient |
|---------|-----------|-----------|
| User registers | Welcome email | New user |
| Verification requested | Email verification link | User |
| Forgot password | Password reset link | User |
| Claim created | New claim notification | Item owner |
| Verification complete | Claim result (pass/fail) | Claimant |
| OTP verified | Handover confirmation | Both parties |
| Item expiring | Expiry warning (7 days) | Item reporter |
| Dispute opened | Dispute notification | Both parties |

> **Note:** If BREVO_SMTP_USER is not set, the app works normally — emails are logged to console instead of being sent. No features break.

---

## Monitoring

- **Health endpoint:** `GET /api/v1/health` returns database connectivity status
- **Docker health checks:** Both containers have built-in health checks
- **Logs:** `docker compose logs -f api` for backend logs

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Check `CORS_ORIGIN` includes frontend URL exactly |
| Database connection failed | Verify `DATABASE_URL` format and accessibility |
| 401 errors | Check JWT secrets match between server restarts |
| Blank page on frontend | Check `VITE_API_URL` is set correctly |
| Slow initial load on Render | Free tier spins down after inactivity (normal) |
| Emails not sending | Check `BREVO_SMTP_USER` and `BREVO_SMTP_KEY` are set |
| Email health check shows "not connected" | Verify Brevo master password is correct |
| Password reset not received | Check spam folder; verify `FRONTEND_URL` is correct |
