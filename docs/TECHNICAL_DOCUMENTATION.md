# Byaboneka+ Technical Documentation
## Architecture, Database Schema & Deployment Runbook

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS / CLIENTS                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Citizen  │  │Coop Staff│  │  Admin   │  │ Mobile (Web) │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
└───────┼──────────────┼──────────────┼───────────────┼───────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              React.js 18 + Tailwind CSS                  │    │
│  │  ┌─────────┐ ┌──────────┐ ┌───────┐ ┌───────────────┐  │    │
│  │  │  Pages  │ │Components│ │ Store │ │ i18n (EN/FR/RW)│  │    │
│  │  │ (27)    │ │ (14)     │ │Zustand│ │ 617 keys       │  │    │
│  │  └─────────┘ └──────────┘ └───────┘ └───────────────┘  │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │ Axios HTTP (JWT in Auth header)        │
│  Hosted: Vercel         │ reCAPTCHA v3 tokens                   │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │             Node.js 20 + Express.js                      │    │
│  │                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │
│  │  │  Middleware   │  │  Controllers │  │   Services   │  │    │
│  │  │  ──────────── │  │  ──────────  │  │  ──────────  │  │    │
│  │  │  auth (JWT)   │  │  auth        │  │  matching    │  │    │
│  │  │  validation   │  │  lostItems   │  │  trust       │  │    │
│  │  │  rateLimiter  │  │  foundItems  │  │  fraud       │  │    │
│  │  │  recaptcha    │  │  claims      │  │  OTP         │  │    │
│  │  │  consent      │  │  messages    │  │  email       │  │    │
│  │  │  csrf         │  │  admin       │  │  audit       │  │    │
│  │  │  errorHandler │  │  cooperatives│  │  expiry      │  │    │
│  │  │  fraudCheck   │  │  account     │  │  redaction   │  │    │
│  │  └──────────────┘  └──────────────┘  │  verification│  │    │
│  │                                       │  leaderboard │  │    │
│  │  ┌──────────────┐  ┌──────────────┐  │  retention   │  │    │
│  │  │   Routes     │  │  Cron Jobs   │  └──────────────┘  │    │
│  │  │  ──────────  │  │  ──────────  │                     │    │
│  │  │  /auth/*     │  │  2AM: expiry │                     │    │
│  │  │  /lost-items │  │  1AM: warn   │                     │    │
│  │  │  /found-items│  │  3AM Sun:    │                     │    │
│  │  │  /claims/*   │  │   retention  │                     │    │
│  │  │  /messages/* │  └──────────────┘                     │    │
│  │  │  /admin/*    │                                        │    │
│  │  │  /users/me   │  Swagger: /api-docs                   │    │
│  │  └──────────────┘                                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│  Hosted: Render          Helmet.js + CORS + morgan              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ pg (parameterized queries)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              PostgreSQL 16                                │    │
│  │                                                          │    │
│  │  Core Tables:         Security Tables:    System Tables: │    │
│  │  ─────────────        ───────────────     ──────────────│    │
│  │  users                refresh_tokens      audit_logs     │    │
│  │  lost_items           password_reset_     notification_  │    │
│  │  found_items           tokens              preferences   │    │
│  │  verification_        email_verification_ matches        │    │
│  │   secrets              tokens                            │    │
│  │  claims               scam_reports                       │    │
│  │  handover_            disputes                           │    │
│  │   confirmations                                          │    │
│  │  messages             Org Tables:                        │    │
│  │                       ──────────                         │    │
│  │                       cooperatives                       │    │
│  └──────────────────────────────────────────────────────────┘    │
│  Hosted: Render PostgreSQL / Docker                              │
└─────────────────────────────────────────────────────────────────┘

External Services:
  ├── Brevo SMTP ────── Transactional emails (welcome, reset, match, expiry)
  ├── Google reCAPTCHA ── Bot prevention (v3, graceful degradation)
  └── Sentry (optional) ── Error monitoring & performance tracking
```

---

## 2. Database Schema (Entity Relationship)

```
┌──────────────────────┐     ┌──────────────────────┐
│       USERS          │     │    COOPERATIVES       │
├──────────────────────┤     ├──────────────────────┤
│ id (PK)              │     │ id (PK)              │
│ email (UNIQUE)       │◄────│ registration_number  │
│ password_hash        │     │ name                 │
│ name                 │     │ contact_info (JSON)  │
│ phone                │     │ status               │
│ role (ENUM)          │     │ created_at           │
│ trust_score (INT)    │     └──────────────────────┘
│ email_verified       │
│ phone_verified       │     ┌──────────────────────┐
│ is_banned            │     │   AUDIT_LOGS         │
│ accepted_terms_at    │     ├──────────────────────┤
│ failed_login_attempts│     │ id (PK)              │
│ created_at           │     │ actor_id (FK→users)  │
└───────┬──────────────┘     │ action               │
        │                     │ resource_type        │
        │ 1:N                 │ resource_id          │
        ▼                     │ changes (JSONB)      │
┌──────────────────────┐     │ ip_address           │
│    LOST_ITEMS        │     │ user_agent           │
├──────────────────────┤     │ timestamp            │
│ id (PK)              │     └──────────────────────┘
│ user_id (FK→users)   │
│ category (ENUM)      │     ┌──────────────────────┐
│ title                │     │ VERIFICATION_SECRETS │
│ description          │     ├──────────────────────┤
│ location_area        │     │ id (PK)              │
│ location_hint        │     │ lost_item_id (FK)    │
│ lost_date            │     │ question_1_text      │
│ status (ENUM)        │     │ answer_1_hash        │
│ expired_at           │     │ question_2_text      │
│ expiry_warning_sent  │     │ answer_2_hash        │
│ created_at           │     │ question_3_text      │
└───────┬──────────────┘     │ answer_3_hash        │
        │                     │ created_at           │
        │ 1:N                 └──────────────────────┘
        ▼
┌──────────────────────┐     ┌──────────────────────┐
│      CLAIMS          │     │ HANDOVER_            │
├──────────────────────┤     │ CONFIRMATIONS        │
│ id (PK)              │     ├──────────────────────┤
│ lost_item_id (FK)    │     │ id (PK)              │
│ found_item_id (FK)   │────►│ claim_id (FK)        │
│ claimant_id (FK)     │     │ otp_code_hash        │
│ status (ENUM)        │     │ otp_expires_at       │
│ verification_score   │     │ otp_verified         │
│ attempts_made        │     │ verification_attempts│
│ created_at           │     │ return_confirmed_by  │
└──────────────────────┘     │ returned_at          │
                              └──────────────────────┘
┌──────────────────────┐
│    FOUND_ITEMS       │     ┌──────────────────────┐
├──────────────────────┤     │    MESSAGES          │
│ id (PK)              │     ├──────────────────────┤
│ user_id (FK→users)   │     │ id (PK)              │
│ cooperative_id (FK)  │     │ claim_id (FK)        │
│ category (ENUM)      │     │ sender_id (FK→users) │
│ title                │     │ content              │
│ description          │     │ is_read              │
│ location_area        │     │ is_scam              │
│ location_hint        │     │ created_at           │
│ found_date           │     └──────────────────────┘
│ image_url            │
│ status (ENUM)        │     ┌──────────────────────┐
│ source (ENUM)        │     │   SCAM_REPORTS       │
│ expired_at           │     ├──────────────────────┤
│ created_at           │     │ id (PK)              │
└──────────────────────┘     │ reporter_id (FK)     │
                              │ reported_user_id (FK)│
ENUMS:                        │ claim_id (FK)        │
  user_role: citizen,         │ reason               │
    coop_staff, admin         │ status               │
  item_category: PHONE,      │ created_at           │
    ID, WALLET, BAG,          └──────────────────────┘
    KEYS, OTHER
  lost_item_status: ACTIVE,
    CLAIMED, RETURNED, EXPIRED
  found_item_status: UNCLAIMED,
    MATCHED, RETURNED, EXPIRED
  claim_status: PENDING, VERIFIED,
    REJECTED, RETURNED, DISPUTED,
    CANCELLED, EXPIRED
```

---

## 3. Deployment Runbook

### 3.1 Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Git
- npm or Docker

### 3.2 Environment Variables

**Backend (.env)**
```env
# Server
PORT=4000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@host:5432/byaboneka

# Authentication (CRITICAL: generate with crypto.randomBytes(64).toString('hex'))
JWT_SECRET=<64-char-random-hex>
JWT_REFRESH_SECRET=<64-char-random-hex>

# Email (Brevo SMTP)
BREVO_SMTP_USER=your-brevo-login
BREVO_SMTP_PASS=your-brevo-password
EMAIL_FROM=noreply@byaboneka.rw
FRONTEND_URL=https://byaboneka.vercel.app

# reCAPTCHA v3
RECAPTCHA_SECRET_KEY=your-google-recaptcha-secret

# CORS
CORS_ORIGIN=https://byaboneka.vercel.app,https://www.byaboneka.rw

# Monitoring (optional)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**Frontend (.env)**
```env
VITE_API_URL=https://your-backend.onrender.com/api/v1
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### 3.3 Deployment Steps

**Backend (Render)**
```bash
# 1. Push to GitHub
git push origin main

# 2. Render auto-deploys from main branch
# Build command: npm ci && npm run build
# Start command: npm start

# 3. Verify
curl https://your-backend.onrender.com/api/v1/health
```

**Frontend (Vercel)**
```bash
# 1. Push to GitHub
git push origin main

# 2. Vercel auto-deploys
# Framework: Vite
# Build: npm run build
# Output: dist

# 3. Verify
curl -I https://byaboneka.vercel.app
```

**Docker (local/staging)**
```bash
docker-compose up -d
# Backend: http://localhost:4000/api-docs
# DB: localhost:5432
```

### 3.4 Post-Deployment Checklist
- [ ] Health endpoint returns 200: `GET /api/v1/health`
- [ ] Database connected (check health response)
- [ ] Swagger docs accessible: `/api-docs`
- [ ] Email service connected (check server logs)
- [ ] reCAPTCHA functioning (try registration)
- [ ] CORS allowing frontend origin
- [ ] Cron jobs scheduled (check logs at 1AM, 2AM, 3AM Sunday)
- [ ] Backup script running: `./scripts/backup-db.sh`

### 3.5 Rollback Procedure
```bash
# Backend: Render dashboard → Manual Deploy → select previous commit
# Frontend: Vercel dashboard → Deployments → Promote previous
# Database: pg_restore from backup (see scripts/backup-db.sh)
```

### 3.6 Monitoring
- Sentry: Error tracking + performance
- Health endpoint: Uptime monitoring (UptimeRobot, Render built-in)
- Cron logs: Check daily cleanup results in server output
- Audit logs: Admin dashboard → Audit Logs section

---

## 4. Third-Party License Summary

| Dependency | License | Risk |
|-----------|---------|------|
| React | MIT | ✅ Safe |
| Express.js | MIT | ✅ Safe |
| Tailwind CSS | MIT | ✅ Safe |
| PostgreSQL | PostgreSQL License | ✅ Safe |
| bcryptjs | MIT | ✅ Safe |
| jsonwebtoken | MIT | ✅ Safe |
| Zod | MIT | ✅ Safe |
| Helmet.js | MIT | ✅ Safe |
| Lucide React | ISC | ✅ Safe |
| i18next | MIT | ✅ Safe |
| Zustand | MIT | ✅ Safe |
| Axios | MIT | ✅ Safe |
| node-cron | ISC | ✅ Safe |
| multer | MIT | ✅ Safe |

All production dependencies use MIT, ISC, or similarly permissive licenses.
No GPL/AGPL/SSPL copyleft dependencies detected.

Run `npx license-checker --production --summary` to verify.

---

## 5. Data Processing Agreement (Cooperative Partners)

Cooperatives using Byaboneka+ agree to the following data handling terms:

1. **Data Access**: Staff accounts can only view items registered at their cooperative
2. **Data Use**: Item data is used solely for facilitating lost item returns
3. **Data Retention**: Cooperatives do not retain copies of platform data outside the system
4. **Audit Trail**: All staff actions are logged and visible to administrators
5. **Staff Management**: Cooperatives are responsible for managing their staff account access
6. **Accountability**: Cooperative performance metrics (return rate, response time) are publicly visible on the leaderboard
7. **Termination**: Upon cooperative deactivation, staff accounts are suspended and data access revoked

*This template should be reviewed by legal counsel before use with real cooperative partners.*
