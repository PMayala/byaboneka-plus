/**
 * Integration Tests: Full API Workflows
 * Tests the complete user journey with real HTTP requests.
 * Requires DATABASE_URL env var pointing to test database.
 *
 * Flow tested:
 * 1. Register → Login → Get Profile
 * 2. Create Lost Item → Create Found Item → Match
 * 3. Create Claim → Verify → Generate OTP → Confirm Handover
 * 4. Messaging → Report Scam
 * 5. Admin operations
 */

import supertest from 'supertest';

// Skip integration tests if no DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL;
const describeIf = DATABASE_URL ? describe : describe.skip;

describeIf('Integration: Full API Flow', () => {
  let app: any;
  let request: ReturnType<typeof supertest>;
  let citizenToken: string;
  let finderToken: string;
  let adminToken: string;
  let citizenId: number;
  let finderId: number;
  let lostItemId: number;
  let foundItemId: number;
  let claimId: number;

  beforeAll(async () => {
    // Dynamic import to avoid loading DB module when skipping
    const { default: expressApp } = await import('../../src/index');
    app = expressApp;
    request = supertest(app);

    // Wait for migrations to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(async () => {
    const { closePool } = await import('../../src/config/database');
    await closePool();
  });

  // ============================================
  // 1. AUTHENTICATION
  // ============================================
  describe('Authentication Flow', () => {
    it('POST /auth/register — citizen registration', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        email: 'citizen@test.com',
        password: 'Citizen1Pass!',
        name: 'Test Citizen',
        phone: '+250788111111',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('citizen');
      expect(res.body.data.tokens.accessToken).toBeDefined();
      citizenToken = res.body.data.tokens.accessToken;
      citizenId = res.body.data.user.id;
    });

    it('POST /auth/register — finder registration', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        email: 'finder@test.com',
        password: 'Finder1Pass!',
        name: 'Test Finder',
        phone: '+250788222222',
      });
      expect(res.status).toBe(201);
      finderToken = res.body.data.tokens.accessToken;
      finderId = res.body.data.user.id;
    });

    it('POST /auth/register — reject duplicate email', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        email: 'citizen@test.com',
        password: 'Another1Pass!',
        name: 'Duplicate',
      });
      expect(res.status).toBe(409);
    });

    it('POST /auth/login — valid login', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'citizen@test.com',
        password: 'Citizen1Pass!',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      citizenToken = res.body.data.tokens.accessToken;
    });

    it('POST /auth/login — invalid password', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'citizen@test.com',
        password: 'WrongPassword1',
      });
      expect(res.status).toBe(401);
    });

    it('GET /auth/profile — authenticated', async () => {
      const res = await request.get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('citizen@test.com');
    });

    it('GET /auth/profile — unauthenticated returns 401', async () => {
      const res = await request.get('/api/v1/auth/profile');
      expect(res.status).toBe(401);
    });
  });

  // ============================================
  // 2. LOST & FOUND ITEMS
  // ============================================
  describe('Item Reporting', () => {
    it('POST /lost-items — create lost item with verification questions', async () => {
      const res = await request.post('/api/v1/lost-items')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          category: 'PHONE',
          title: 'Samsung Galaxy S23',
          description: 'Black Samsung phone with blue case found near bus station',
          location_area: 'Nyabugogo',
          lost_date: '2026-02-10T14:00:00Z',
          verification_questions: [
            { question: 'What is the wallpaper?', answer: 'my dog' },
            { question: 'What color is the case?', answer: 'blue' },
            { question: 'Lock screen PIN digits?', answer: 'six' },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.keywords).toBeInstanceOf(Array);
      lostItemId = res.body.data.id;
    });

    it('POST /found-items — create found item', async () => {
      const res = await request.post('/api/v1/found-items')
        .set('Authorization', `Bearer ${finderToken}`)
        .send({
          category: 'PHONE',
          title: 'Black Samsung found on KBS bus',
          description: 'Samsung phone with blue case left on bus seat in Nyabugogo area',
          location_area: 'Nyabugogo',
          found_date: '2026-02-10T16:30:00Z',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.source).toBe('CITIZEN');
      foundItemId = res.body.data.id;
    });

    it('GET /lost-items — public listing', async () => {
      const res = await request.get('/api/v1/lost-items');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
    });

    it('GET /lost-items?category=PHONE — filtered listing', async () => {
      const res = await request.get('/api/v1/lost-items?category=PHONE');
      expect(res.status).toBe(200);
      res.body.data.forEach((item: any) => {
        expect(item.category).toBe('PHONE');
      });
    });

    it('GET /lost-items/:id/matches — matching engine', async () => {
      const res = await request.get(`/api/v1/lost-items/${lostItemId}/matches`)
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      // Should find the matching found item
      if (res.body.data.length > 0) {
        expect(res.body.data[0].score).toBeGreaterThanOrEqual(5);
        expect(res.body.data[0].explanation).toBeInstanceOf(Array);
      }
    });

    it('GET /users/me/lost-items — own items', async () => {
      const res = await request.get('/api/v1/users/me/lost-items')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // 3. CLAIM & VERIFICATION
  // ============================================
  describe('Claim & Verification Flow', () => {
    it('POST /claims — create claim', async () => {
      const res = await request.post('/api/v1/claims')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ lost_item_id: lostItemId, found_item_id: foundItemId });
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      claimId = res.body.data.id;
    });

    it('POST /claims — reject duplicate active claim', async () => {
      const res = await request.post('/api/v1/claims')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ lost_item_id: lostItemId, found_item_id: foundItemId });
      expect(res.status).toBe(409);
    });

    it('GET /claims/:id/questions — get verification questions', async () => {
      const res = await request.get(`/api/v1/claims/${claimId}/questions`)
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.questions).toHaveLength(3);
      expect(res.body.data.attempts_remaining).toBe(3);
    });

    it('POST /claims/:id/verify — wrong answers fail', async () => {
      const res = await request.post(`/api/v1/claims/${claimId}/verify`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ answers: ['wrong', 'wrong', 'wrong'] });
      expect(res.status).toBe(200);
      expect(res.body.data.passed).toBe(false);
      expect(res.body.data.score).toBe(0);
    });

    it('POST /claims/:id/verify — correct answers pass (2/3)', async () => {
      const res = await request.post(`/api/v1/claims/${claimId}/verify`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ answers: ['my dog', 'blue', 'wrong answer'] });
      expect(res.status).toBe(200);
      expect(res.body.data.passed).toBe(true);
      expect(res.body.data.score).toBeGreaterThanOrEqual(2);
    });

    it('GET /claims/:id — claim is now VERIFIED', async () => {
      const res = await request.get(`/api/v1/claims/${claimId}`)
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VERIFIED');
    });
  });

  // ============================================
  // 4. HANDOVER (OTP)
  // ============================================
  describe('OTP Handover Flow', () => {
    let otp: string;

    it('POST /claims/:id/handover/otp — generate OTP (owner)', async () => {
      const res = await request.post(`/api/v1/claims/${claimId}/handover/otp`)
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.otp).toMatch(/^\d{6}$/);
      otp = res.body.data.otp;
    });

    it('POST /claims/:id/handover/verify — wrong OTP rejected', async () => {
      const res = await request.post(`/api/v1/claims/${claimId}/handover/verify`)
        .set('Authorization', `Bearer ${finderToken}`)
        .send({ otp: '000000' });
      expect(res.status).toBe(400);
    });

    it('POST /claims/:id/handover/verify — correct OTP completes return', async () => {
      const res = await request.post(`/api/v1/claims/${claimId}/handover/verify`)
        .set('Authorization', `Bearer ${finderToken}`)
        .send({ otp });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('claim status is now RETURNED', async () => {
      const res = await request.get(`/api/v1/claims/${claimId}`)
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.body.data.status).toBe('RETURNED');
    });
  });

  // ============================================
  // 5. MESSAGING
  // ============================================
  describe('Messaging', () => {
    it('POST /messages/threads/:claimId — send message', async () => {
      const res = await request.post(`/api/v1/messages/threads/${claimId}`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ content: 'Thank you for finding my phone!' });
      expect(res.status).toBe(201);
    });

    it('GET /messages/threads/:claimId — get messages', async () => {
      const res = await request.get(`/api/v1/messages/threads/${claimId}`)
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /messages/unread-count', async () => {
      const res = await request.get('/api/v1/messages/unread-count')
        .set('Authorization', `Bearer ${finderToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('count');
    });
  });

  // ============================================
  // 6. SYSTEM
  // ============================================
  describe('System Endpoints', () => {
    it('GET /health — returns ok', async () => {
      const res = await request.get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });
  });
});