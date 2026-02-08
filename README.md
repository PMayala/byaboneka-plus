# Byaboneka+ 🇷🇼

> **Trust-Aware Lost & Found Infrastructure for Rwanda's Transport Ecosystem**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Byaboneka+ is Rwanda's first comprehensive lost and found platform designed specifically for the transport sector.

## 🌟 Features

- **Smart Matching** - AI-powered matching based on category, location, time, and keywords
- **Secure Verification** - 3-question verification to prove ownership
- **OTP Handover** - Secure 6-digit OTP confirmation
- **Trust Scoring** - Reputation system rewarding honest behavior
- **In-App Messaging** - Secure communication with scam detection
- **Cooperative Integration** - 146+ transport cooperatives

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### Local Development

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev

# Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

**Access:** Frontend: http://localhost:3000 | API: http://localhost:4000/api/v1

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@byaboneka.rw | Admin@123 |
| Citizen | emmanuel.k@gmail.com | User@123 |

## 🚢 Deployment

### Vercel (Frontend)
1. Connect repo to Vercel
2. Set `VITE_API_URL` to your backend URL
3. Deploy

### Render (Backend)
1. Create Web Service from `/backend`
2. Build: `npm ci && npm run build`
3. Start: `npm start`
4. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`

## 📚 API Documentation

- **Swagger:** `docs/swagger/openapi.yaml`
- **Postman:** `docs/postman/Byaboneka-API.postman_collection.json`

## 🛠️ Tech Stack

**Backend:** Node.js, Express, TypeScript, PostgreSQL, JWT
**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand

## 📄 License

MIT License - Built with ❤️ in Rwanda
