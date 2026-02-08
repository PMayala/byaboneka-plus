# Byaboneka+ API Documentation

## Base URL
```
Production: https://api.byaboneka.rw/api/v1
Development: http://localhost:4000/api/v1
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Jean Claude",
  "phone": "+250788123456"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "user@example.com", "name": "Jean Claude", "role": "citizen" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST /auth/login
Authenticate and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### POST /auth/refresh
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

### POST /auth/forgot-password
Request password reset email.

### POST /auth/reset-password
Reset password with token.

### GET /auth/profile
Get current user profile. (Protected)

### PUT /auth/profile
Update user profile. (Protected)

---

## Lost Items Endpoints

### POST /lost-items
Create a lost item report with verification questions. (Protected)

**Request Body:**
```json
{
  "category": "PHONE",
  "title": "Black iPhone 14",
  "description": "Lost on moto near Kimironko market",
  "location_area": "Kimironko",
  "location_hint": "Near the main market entrance",
  "lost_date": "2026-01-20T10:30:00Z",
  "verification_questions": [
    { "question": "What is the lockscreen wallpaper?", "answer": "mountain sunset" },
    { "question": "What color is the phone case?", "answer": "blue" },
    { "question": "Any distinctive marks?", "answer": "small scratch on corner" }
  ]
}
```

**Categories:** PHONE, ID, WALLET, BAG, KEYS, OTHER

### GET /lost-items
Search lost items with filters.

**Query Parameters:**
- `category` - Filter by category
- `location_area` - Filter by location
- `date_from` - Filter by date range start
- `date_to` - Filter by date range end
- `keyword` - Search keywords
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)

### GET /lost-items/:id
Get lost item details.

### PUT /lost-items/:id
Update lost item. (Protected, Owner only)

### DELETE /lost-items/:id
Delete lost item. (Protected, Owner only)

### GET /lost-items/:id/matches
Get matching found items. (Protected, Owner only)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "found_item": { "id": 5, "title": "Black phone found", ... },
      "score": 13,
      "explanation": ["Category match: PHONE (+5)", "Same location: Kimironko (+5)", "Within 24h: (+3)"]
    }
  ]
}
```

### GET /users/me/lost-items
Get current user's lost items. (Protected)

---

## Found Items Endpoints

### POST /found-items
Report a found item. (Protected)

**Request Body:**
```json
{
  "category": "PHONE",
  "title": "Black smartphone found",
  "description": "Found on bus from Nyabugogo",
  "location_area": "Nyabugogo",
  "location_hint": "On Route 102 bus",
  "found_date": "2026-01-20T14:00:00Z"
}
```

### POST /found-items/:id/images
Upload images for a found item. (Protected, Owner only)

**Form Data:**
- `images` - Up to 5 image files (JPEG, PNG, WebP, max 5MB each)

### GET /found-items
Search found items with filters.

### GET /found-items/:id
Get found item details.

### PUT /found-items/:id
Update found item. (Protected, Owner only)

### DELETE /found-items/:id
Delete found item. (Protected, Owner only)

### GET /users/me/found-items
Get current user's found items. (Protected)

---

## Claims Endpoints

### POST /claims
Create a claim for a found item. (Protected)

**Request Body:**
```json
{
  "lost_item_id": 1,
  "found_item_id": 5
}
```

### GET /claims/:claimId
Get claim details. (Protected, Participants only)

### GET /claims/:claimId/questions
Get verification questions for a claim. (Protected, Claimant only)

**Response:**
```json
{
  "success": true,
  "data": {
    "claim_id": 1,
    "questions": [
      "What is the lockscreen wallpaper?",
      "What color is the phone case?",
      "Any distinctive marks?"
    ],
    "attempts_remaining": 3
  }
}
```

### POST /claims/:claimId/verify
Submit verification answers. (Protected, Claimant only)

**Request Body:**
```json
{
  "answers": ["mountain sunset", "blue", "small scratch"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "passed": true,
    "score": 3,
    "attempts_remaining": 2,
    "message": "Verification successful! You can now coordinate handover."
  }
}
```

### POST /claims/:claimId/cancel
Cancel a claim. (Protected, Claimant only)

### GET /users/me/claims
Get current user's claims. (Protected)

---

## Handover Endpoints

### POST /handovers/:claimId/generate-otp
Generate OTP for handover. (Protected, Item owner only)

**Response:**
```json
{
  "success": true,
  "data": {
    "otp": "482916",
    "expires_in": "24 hours",
    "message": "Share this code only when you physically receive your item."
  }
}
```

### POST /handovers/:claimId/confirm
Confirm handover with OTP. (Protected, Finder or Coop Staff only)

**Request Body:**
```json
{
  "otp": "482916"
}
```

---

## Messages Endpoints

### GET /messages/threads
Get all message threads. (Protected)

### GET /messages/threads/:claimId
Get messages for a claim. (Protected, Participants only)

### POST /messages/threads/:claimId
Send a message. (Protected, Participants only)

**Request Body:**
```json
{
  "content": "Hi, when can we meet for handover?"
}
```

### POST /messages/:messageId/report
Report a message as scam. (Protected)

**Request Body:**
```json
{
  "reason": "Asking for money before returning item"
}
```

### GET /messages/unread-count
Get unread message count. (Protected)

---

## Cooperatives Endpoints (Admin/Staff)

### GET /cooperatives
List all cooperatives.

### GET /cooperatives/:id
Get cooperative details.

### POST /cooperatives
Create a cooperative. (Admin only)

### PATCH /cooperatives/:id/status
Update cooperative status. (Admin only)

### POST /cooperatives/:id/staff
Add staff member to cooperative. (Admin only)

### GET /cooperatives/:id/staff
Get cooperative staff list. (Admin/Staff only)

### GET /cooperatives/:id/items
Get cooperative's found items. (Admin/Staff only)

### GET /cooperative/dashboard
Get cooperative dashboard data. (Coop Staff only)

---

## Admin Endpoints

### GET /admin/stats
Get platform statistics. (Admin only)

### GET /admin/users
List all users with filters. (Admin only)

### POST /admin/users/:userId/ban
Ban a user. (Admin only)

### POST /admin/users/:userId/unban
Unban a user. (Admin only)

### GET /admin/scam-reports
List scam reports. (Admin only)

### POST /admin/scam-reports/:reportId/resolve
Resolve a scam report. (Admin only)

### GET /admin/audit-logs
View audit logs. (Admin only)

### POST /admin/users/:userId/recalculate-trust
Recalculate user's trust score. (Admin only)

### POST /admin/cleanup
Run cleanup job manually. (Admin only)

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Auth (login/register) | 5 per minute |
| Report creation | 10 per hour |
| Claim creation | 5 per hour |
| Verification attempts | 3 per 24 hours |
| OTP operations | 5 per hour |
| Messages | 30 per minute |
| Search | 60 per minute |
| Password reset | 3 per hour |

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

### Common Status Codes
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Item Status Flow

### Lost Item Status
```
ACTIVE → CLAIMED → RETURNED
       ↘ EXPIRED
```

### Found Item Status
```
UNCLAIMED → MATCHED → RETURNED
          ↘ EXPIRED
```

### Claim Status
```
PENDING → VERIFIED → RETURNED
        ↘ REJECTED
        ↘ CANCELLED
        ↘ EXPIRED
```

---

## Security Features

1. **Password Hashing**: bcrypt with cost factor 10
2. **Secret Answer Hashing**: bcrypt with random salt
3. **JWT Tokens**: 15-minute access, 7-day refresh
4. **Rate Limiting**: Per-endpoint limits
5. **Audit Logging**: All critical actions logged
6. **Input Validation**: Joi schema validation
7. **CORS**: Configurable origin restriction
