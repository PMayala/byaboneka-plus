import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Byaboneka+ API',
      version: '1.0.0',
      description: `
## Trust-Aware Lost & Found Infrastructure for Rwanda

Byaboneka+ provides a comprehensive platform for lost and found item management
across Rwanda's transport ecosystem. The API supports citizen reporting, cooperative
integration, intelligent matching, fraud-resistant verification, and secure OTP-based
handover protocols.

### Key Features
- **Private Verification** — Owners set secret questions only they can answer
- **OTP Handover** — One-time codes ensure items are returned after physical exchange
- **Cooperative Integration** — Transport cooperatives serve as trusted intermediaries
- **Trust Scoring** — Behavioral tracking discourages abuse and rewards good actors
- **Explainable Matching** — Transparent logic builds user confidence in system suggestions

### Authentication
All protected endpoints require a Bearer token in the Authorization header.
Access tokens expire after 15 minutes. Use the refresh token endpoint to obtain new tokens.

### Rate Limits
- Authentication: 10 requests / 15 minutes
- Report creation: 5 / hour
- Claim attempts: 3 / hour
- Verification: 5 / hour
- Messages: 50 / hour
- General API: 100 / minute
      `,
      contact: {
        name: 'MAYALA Plamedi',
        email: 'p.mayala@alustudent.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      schemas: {
        // ====== Common ======
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 150 },
            totalPages: { type: 'integer', example: 8 },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },

        // ====== Auth ======
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email', example: 'jean@example.com' },
            password: { type: 'string', minLength: 8, example: 'MySecure1Pass' },
            name: { type: 'string', example: 'Jean Habimana' },
            phone: { type: 'string', example: '+250788123456' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'jean@example.com' },
            password: { type: 'string', example: 'MySecure1Pass' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/UserProfile' },
                tokens: {
                  type: 'object',
                  properties: {
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 8 },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },

        // ====== Users ======
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', example: 'jean@example.com' },
            name: { type: 'string', example: 'Jean Habimana' },
            phone: { type: 'string', example: '+250788123456', nullable: true },
            role: { type: 'string', enum: ['citizen', 'coop_staff', 'admin'], example: 'citizen' },
            trust_score: { type: 'integer', example: 5 },
            email_verified: { type: 'boolean', example: false },
            cooperative_name: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },

        // ====== Lost Items ======
        CreateLostItemRequest: {
          type: 'object',
          required: ['category', 'title', 'description', 'location_area', 'lost_date', 'verification_questions'],
          properties: {
            category: { type: 'string', enum: ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'], example: 'PHONE' },
            title: { type: 'string', example: 'Samsung Galaxy S23 Ultra' },
            description: { type: 'string', example: 'Black Samsung phone with cracked screen protector, blue case' },
            location_area: { type: 'string', example: 'Nyabugogo' },
            location_hint: { type: 'string', example: 'Near the main bus station' },
            lost_date: { type: 'string', format: 'date-time', example: '2026-02-10T14:00:00Z' },
            photo_url: { type: 'string', format: 'uri', nullable: true },
            verification_questions: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: {
                type: 'object',
                required: ['question', 'answer'],
                properties: {
                  question: { type: 'string', example: 'What is your phone wallpaper?' },
                  answer: { type: 'string', example: 'my dog' },
                },
              },
            },
          },
        },
        LostItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            user_id: { type: 'integer' },
            category: { type: 'string', enum: ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'] },
            title: { type: 'string' },
            description: { type: 'string' },
            location_area: { type: 'string' },
            location_hint: { type: 'string', nullable: true },
            lost_date: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['ACTIVE', 'CLAIMED', 'RETURNED', 'EXPIRED'] },
            keywords: { type: 'array', items: { type: 'string' } },
            photo_url: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },

        // ====== Found Items ======
        CreateFoundItemRequest: {
          type: 'object',
          required: ['category', 'title', 'description', 'location_area', 'found_date'],
          properties: {
            category: { type: 'string', enum: ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'], example: 'PHONE' },
            title: { type: 'string', example: 'Black Samsung phone found on bus' },
            description: { type: 'string', example: 'Found a black Samsung phone on the seat of bus KBS-205' },
            location_area: { type: 'string', example: 'Nyabugogo' },
            location_hint: { type: 'string', example: 'KBS Bus #205, route Nyabugogo-Kimironko' },
            found_date: { type: 'string', format: 'date-time', example: '2026-02-10T16:30:00Z' },
            cooperative_id: { type: 'integer', nullable: true, description: 'For cooperative staff only' },
          },
        },
        FoundItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            finder_id: { type: 'integer' },
            cooperative_id: { type: 'integer', nullable: true },
            category: { type: 'string', enum: ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'] },
            title: { type: 'string' },
            description: { type: 'string' },
            location_area: { type: 'string' },
            found_date: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['UNCLAIMED', 'MATCHED', 'RETURNED', 'EXPIRED'] },
            source: { type: 'string', enum: ['CITIZEN', 'COOPERATIVE'] },
            image_urls: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            created_at: { type: 'string', format: 'date-time' },
          },
        },

        // ====== Claims ======
        CreateClaimRequest: {
          type: 'object',
          required: ['lost_item_id', 'found_item_id'],
          properties: {
            lost_item_id: { type: 'integer', example: 1 },
            found_item_id: { type: 'integer', example: 1 },
          },
        },
        VerifyClaimRequest: {
          type: 'object',
          required: ['answers'],
          properties: {
            answers: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: { type: 'string' },
              example: ['my dog', 'gasabo', '1990'],
            },
          },
        },
        Claim: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            lost_item_id: { type: 'integer' },
            found_item_id: { type: 'integer' },
            claimant_id: { type: 'integer' },
            status: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED', 'RETURNED', 'DISPUTED', 'CANCELLED', 'EXPIRED'] },
            verification_score: { type: 'number', format: 'float' },
            attempts_made: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        VerificationQuestionsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                claim_id: { type: 'integer' },
                questions: { type: 'array', items: { type: 'string' }, example: ['What is your wallpaper?', 'What color is the case?', 'What is the lock screen?'] },
                attempts_remaining: { type: 'integer', example: 3 },
              },
            },
          },
        },
        VerificationResultResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                passed: { type: 'boolean' },
                score: { type: 'integer', example: 2 },
                attempts_remaining: { type: 'integer' },
                message: { type: 'string' },
              },
            },
          },
        },

        // ====== Handover ======
        OTPGenerateResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                otp: { type: 'string', example: '847291' },
                expires_in: { type: 'string', example: '24 hours' },
                message: { type: 'string' },
              },
            },
          },
        },
        OTPVerifyRequest: {
          type: 'object',
          required: ['otp'],
          properties: {
            otp: { type: 'string', pattern: '^\\d{6}$', example: '847291' },
          },
        },

        // ====== Messages ======
        SendMessageRequest: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', maxLength: 1000, example: 'Hi, I found your phone. When can we meet?' },
          },
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            sender_id: { type: 'integer' },
            receiver_id: { type: 'integer' },
            claim_id: { type: 'integer' },
            content: { type: 'string' },
            is_read: { type: 'boolean' },
            is_flagged: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },

        // ====== Cooperatives ======
        CreateCooperativeRequest: {
          type: 'object',
          required: ['name', 'registration_number', 'contact_info'],
          properties: {
            name: { type: 'string', example: 'Kigali Bus Services (KBS)' },
            registration_number: { type: 'string', example: 'RW-COOP-2024-001' },
            contact_info: { type: 'string', example: '+250788000111' },
            address: { type: 'string', example: 'Nyabugogo Terminal, Kigali' },
          },
        },
        Cooperative: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            registration_number: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'VERIFIED', 'SUSPENDED'] },
            contact_info: { type: 'string' },
            address: { type: 'string', nullable: true },
            staff_count: { type: 'integer' },
            items_count: { type: 'integer' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },

        // ====== Disputes ======
        CreateDisputeRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', minLength: 20, example: 'I forgot the exact answer to question 2 but this is definitely my phone. I can show the purchase receipt.' },
            evidence_urls: { type: 'array', items: { type: 'string', format: 'uri' } },
          },
        },
        ResolveDisputeRequest: {
          type: 'object',
          required: ['resolution', 'resolution_notes'],
          properties: {
            resolution: { type: 'string', enum: ['RESOLVED_OWNER', 'RESOLVED_FINDER', 'DISMISSED'] },
            resolution_notes: { type: 'string', example: 'Owner provided purchase receipt as proof.' },
          },
        },

        // ====== Matches ======
        MatchResult: {
          type: 'object',
          properties: {
            found_item: { $ref: '#/components/schemas/FoundItem' },
            score: { type: 'integer', example: 11, description: 'Match confidence score (min 5 to display)' },
            explanation: {
              type: 'array',
              items: { type: 'string' },
              example: ['Category: PHONE (+5)', 'Same location area: Nyabugogo (+3)', 'Within 72 hours (+2)', 'Keyword: samsung (+1)'],
            },
          },
        },

        // ====== Admin ======
        DashboardStats: {
          type: 'object',
          properties: {
            total_users: { type: 'integer' },
            total_lost_items: { type: 'integer' },
            total_found_items: { type: 'integer' },
            total_claims: { type: 'integer' },
            successful_returns: { type: 'integer' },
            pending_scam_reports: { type: 'integer' },
          },
        },
        BanUserRequest: {
          type: 'object',
          required: ['reason'],
          properties: {
            reason: { type: 'string', example: 'Repeated fraudulent claim attempts' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            actor_id: { type: 'integer' },
            action: { type: 'string' },
            resource_type: { type: 'string' },
            resource_id: { type: 'integer' },
            changes: { type: 'object' },
            ip_address: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ScamReport: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            reporter_id: { type: 'integer' },
            reported_user_id: { type: 'integer' },
            reason: { type: 'string' },
            status: { type: 'string', enum: ['OPEN', 'INVESTIGATING', 'RESOLVED'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        CategoryFilter: {
          name: 'category',
          in: 'query',
          schema: { type: 'string', enum: ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'] },
        },
        LocationFilter: {
          name: 'location_area',
          in: 'query',
          schema: { type: 'string' },
          description: 'Filter by sector/neighborhood (partial match)',
        },
        KeywordFilter: {
          name: 'keyword',
          in: 'query',
          schema: { type: 'string' },
          description: 'Search in title and description',
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid authentication token',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Access token required' },
                },
              },
            },
          },
        },
        Forbidden: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Admin access required' },
                },
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Resource not found' },
                },
              },
            },
          },
        },
        RateLimited: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Too many requests. Please try again later.' },
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User registration, login, token management, password reset' },
      { name: 'Lost Items', description: 'Report, search, and manage lost item reports' },
      { name: 'Found Items', description: 'Report, search, and manage found item reports' },
      { name: 'Matching', description: 'Intelligent matching between lost and found items' },
      { name: 'Claims & Verification', description: 'Claim ownership and verify via secret questions' },
      { name: 'Handover', description: 'OTP-based secure item return protocol' },
      { name: 'Disputes', description: 'Dispute resolution for edge cases' },
      { name: 'Messages', description: 'In-app messaging between claim participants' },
      { name: 'Cooperatives', description: 'Transport cooperative management' },
      { name: 'Admin', description: 'System administration and moderation' },
      { name: 'System', description: 'Health checks and system status' },
    ],
    paths: {
      // ============================
      // AUTHENTICATION
      // ============================
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user account',
          description: 'Creates a new citizen account with email and password. Returns JWT tokens for immediate use.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
          responses: {
            201: { description: 'Registration successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            409: { description: 'Email or phone already registered' },
            400: { $ref: '#/components/responses/ValidationError' },
            429: { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login with email and password',
          description: 'Authenticates user and returns JWT access and refresh tokens.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
            401: { description: 'Invalid credentials' },
            403: { description: 'Account suspended' },
            429: { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh access token',
          description: 'Exchange a valid refresh token for a new access token and refresh token pair.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } } },
          responses: {
            200: { description: 'Tokens refreshed' },
            401: { description: 'Invalid or expired refresh token' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout and revoke tokens',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } } },
          responses: { 200: { description: 'Logged out' } },
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Request password reset',
          description: 'Sends a password reset token. Always returns success to prevent email enumeration.',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ForgotPasswordRequest' } } } },
          responses: { 200: { description: 'Reset email sent (if account exists)' } },
        },
      },
      '/auth/reset-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Reset password with token',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } } },
          responses: {
            200: { description: 'Password reset successful' },
            400: { description: 'Invalid or expired token' },
          },
        },
      },
      '/auth/profile': {
        get: {
          tags: ['Authentication'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Profile data', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/UserProfile' } } } } } },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
        put: {
          tags: ['Authentication'],
          summary: 'Update user profile',
          security: [{ bearerAuth: [] }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } } } } },
          responses: { 200: { description: 'Profile updated' } },
        },
      },
      '/auth/change-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Change password (logged-in user)',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } } },
          responses: {
            200: { description: 'Password changed' },
            401: { description: 'Current password incorrect' },
          },
        },
      },

      // ============================
      // LOST ITEMS
      // ============================
      '/lost-items': {
        post: {
          tags: ['Lost Items'],
          summary: 'Report a lost item',
          description: 'Creates a lost item report with 3 private verification questions. Questions are used later to verify ownership claims.',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateLostItemRequest' } } } },
          responses: {
            201: { description: 'Report created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/LostItem' } } } } } },
            400: { $ref: '#/components/responses/ValidationError' },
            401: { $ref: '#/components/responses/Unauthorized' },
          },
        },
        get: {
          tags: ['Lost Items'],
          summary: 'Search and list lost items',
          description: 'Public endpoint. Returns active lost items with optional filters.',
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CategoryFilter' },
            { $ref: '#/components/parameters/LocationFilter' },
            { $ref: '#/components/parameters/KeywordFilter' },
            { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'List of lost items with pagination' } },
        },
      },
      '/lost-items/{id}': {
        get: {
          tags: ['Lost Items'],
          summary: 'Get lost item details',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Lost item details' },
            404: { $ref: '#/components/responses/NotFound' },
          },
        },
        put: {
          tags: ['Lost Items'],
          summary: 'Update own lost item',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, location_area: { type: 'string' } } } } } },
          responses: { 200: { description: 'Updated' }, 404: { $ref: '#/components/responses/NotFound' } },
        },
        delete: {
          tags: ['Lost Items'],
          summary: 'Delete own lost item',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Deleted' }, 400: { description: 'Cannot delete with active claim' } },
        },
      },
      '/lost-items/{id}/matches': {
        get: {
          tags: ['Matching'],
          summary: 'Get matches for a lost item',
          description: 'Returns up to 5 matched found items ranked by score with explanations. Score uses: category (+5), location (+3), time window (+2), keywords (+1 each). Minimum score: 5.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Match results', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { $ref: '#/components/schemas/MatchResult' } } } } } } },
          },
        },
      },
      '/users/me/lost-items': {
        get: {
          tags: ['Lost Items'],
          summary: "List user's own lost items",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: '#/components/parameters/PageParam' }, { $ref: '#/components/parameters/LimitParam' }],
          responses: { 200: { description: "User's lost items" } },
        },
      },

      // ============================
      // FOUND ITEMS
      // ============================
      '/found-items': {
        post: {
          tags: ['Found Items'],
          summary: 'Report a found item',
          description: 'Creates a found item report. Cooperative staff can assign to their cooperative.',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateFoundItemRequest' } } } },
          responses: { 201: { description: 'Report created' } },
        },
        get: {
          tags: ['Found Items'],
          summary: 'Search and list found items',
          description: 'Public. Sensitive items (ID/WALLET) show truncated descriptions for privacy.',
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
            { $ref: '#/components/parameters/CategoryFilter' },
            { $ref: '#/components/parameters/LocationFilter' },
            { $ref: '#/components/parameters/KeywordFilter' },
          ],
          responses: { 200: { description: 'List of found items' } },
        },
      },
      '/found-items/{id}': {
        get: {
          tags: ['Found Items'],
          summary: 'Get found item details',
          description: 'Sensitive items show limited info unless you are the finder or admin.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Found item details' } },
        },
        put: {
          tags: ['Found Items'],
          summary: 'Update own found item',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Updated' } },
        },
        delete: {
          tags: ['Found Items'],
          summary: 'Delete own found item',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Deleted' } },
        },
      },
      '/found-items/{id}/images': {
        post: {
          tags: ['Found Items'],
          summary: 'Upload images for found item',
          description: 'Upload up to 5 images (JPEG, PNG, WebP). Max 5MB each.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { images: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } },
          responses: { 200: { description: 'Images uploaded' } },
        },
      },
      '/found-items/{id}/matches': {
        get: {
          tags: ['Matching'],
          summary: 'Get matches for a found item',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Match results' } },
        },
      },
      '/users/me/found-items': {
        get: {
          tags: ['Found Items'],
          summary: "List user's own found items",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "User's found items" } },
        },
      },

      // ============================
      // CLAIMS & VERIFICATION
      // ============================
      '/claims': {
        post: {
          tags: ['Claims & Verification'],
          summary: 'Initiate a claim',
          description: 'Creates a claim linking a lost item to a found item. Only the lost item owner can create a claim.',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateClaimRequest' } } } },
          responses: {
            201: { description: 'Claim created' },
            409: { description: 'Active claim already exists' },
          },
        },
      },
      '/claims/{claimId}': {
        get: {
          tags: ['Claims & Verification'],
          summary: 'Get claim details',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Claim details' } },
        },
      },
      '/claims/{claimId}/questions': {
        get: {
          tags: ['Claims & Verification'],
          summary: 'Get verification questions',
          description: 'Returns the 3 secret questions set by the item owner. Rate limited: max 3 attempts per day.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Questions', content: { 'application/json': { schema: { $ref: '#/components/schemas/VerificationQuestionsResponse' } } } },
            429: { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/claims/{claimId}/verify': {
        post: {
          tags: ['Claims & Verification'],
          summary: 'Submit verification answers',
          description: 'Requires 2 of 3 correct answers to verify. Progressive cooldown on failures: 1hr → 4hr → 24hr. Max 3 attempts/day.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyClaimRequest' } } } },
          responses: {
            200: { description: 'Verification result', content: { 'application/json': { schema: { $ref: '#/components/schemas/VerificationResultResponse' } } } },
            429: { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/claims/{claimId}/cancel': {
        post: {
          tags: ['Claims & Verification'],
          summary: 'Cancel a claim',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Claim cancelled' } },
        },
      },
      '/users/me/claims': {
        get: {
          tags: ['Claims & Verification'],
          summary: "List user's claims",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "User's claims" } },
        },
      },

      // ============================
      // HANDOVER (OTP)
      // ============================
      '/claims/{claimId}/handover/otp': {
        post: {
          tags: ['Handover'],
          summary: 'Generate handover OTP',
          description: 'Generates a 6-digit OTP for the verified claim owner. OTP is valid for 24 hours. Only the item owner can generate.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'OTP generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/OTPGenerateResponse' } } } },
            400: { description: 'Claim must be verified / OTP already exists' },
          },
        },
      },
      '/claims/{claimId}/handover/verify': {
        post: {
          tags: ['Handover'],
          summary: 'Verify OTP and complete handover',
          description: 'The finder or cooperative staff enters the OTP to confirm the physical item return. Max 3 attempts.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/OTPVerifyRequest' } } } },
          responses: {
            200: { description: 'Handover confirmed — items marked as RETURNED' },
            400: { description: 'Invalid or expired OTP' },
            429: { description: 'Too many failed attempts' },
          },
        },
      },
      '/claims/{claimId}/handover': {
        get: {
          tags: ['Handover'],
          summary: 'Get handover status',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Handover status' } },
        },
      },

      // ============================
      // DISPUTES
      // ============================
      '/claims/{claimId}/dispute': {
        post: {
          tags: ['Disputes'],
          summary: 'File a dispute on a claim',
          description: 'For edge cases where verification fails but user believes they are the owner (e.g., forgot answers).',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateDisputeRequest' } } } },
          responses: { 201: { description: 'Dispute filed' } },
        },
      },
      '/admin/disputes': {
        get: {
          tags: ['Disputes'],
          summary: 'List all disputes (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'UNDER_REVIEW', 'RESOLVED_OWNER', 'RESOLVED_FINDER', 'DISMISSED'] } },
            { $ref: '#/components/parameters/PageParam' },
          ],
          responses: { 200: { description: 'Disputes list' } },
        },
      },
      '/admin/disputes/{disputeId}/resolve': {
        post: {
          tags: ['Disputes'],
          summary: 'Resolve a dispute (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'disputeId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResolveDisputeRequest' } } } },
          responses: { 200: { description: 'Dispute resolved' } },
        },
      },

      // ============================
      // MESSAGES
      // ============================
      '/messages/threads': {
        get: {
          tags: ['Messages'],
          summary: 'List message threads',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Message threads grouped by claim' } },
        },
      },
      '/messages/threads/{claimId}': {
        get: {
          tags: ['Messages'],
          summary: 'Get messages for a claim',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Messages in thread' } },
        },
        post: {
          tags: ['Messages'],
          summary: 'Send a message',
          description: 'Messages are scanned for extortion keywords and flagged automatically.',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'claimId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendMessageRequest' } } } },
          responses: { 201: { description: 'Message sent' } },
        },
      },
      '/messages/{messageId}/report': {
        post: {
          tags: ['Messages'],
          summary: 'Report a message as scam',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } },
          responses: { 201: { description: 'Scam report created' } },
        },
      },
      '/messages/unread-count': {
        get: {
          tags: ['Messages'],
          summary: 'Get unread message count',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Unread count' } },
        },
      },

      // ============================
      // COOPERATIVES
      // ============================
      '/cooperatives': {
        get: {
          tags: ['Cooperatives'],
          summary: 'List cooperatives',
          description: 'Public users see verified cooperatives only. Admins see all.',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'VERIFIED', 'SUSPENDED'] } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Cooperatives list' } },
        },
        post: {
          tags: ['Cooperatives'],
          summary: 'Create cooperative (admin)',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCooperativeRequest' } } } },
          responses: { 201: { description: 'Cooperative created' } },
        },
      },
      '/cooperatives/{id}': {
        get: {
          tags: ['Cooperatives'],
          summary: 'Get cooperative details',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Cooperative details with stats' } },
        },
      },
      '/cooperatives/{id}/status': {
        patch: {
          tags: ['Cooperatives'],
          summary: 'Update cooperative status (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['VERIFIED', 'SUSPENDED'] } } } } } },
          responses: { 200: { description: 'Status updated' } },
        },
      },
      '/cooperatives/{id}/staff': {
        post: {
          tags: ['Cooperatives'],
          summary: 'Add staff member (admin)',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'name'], properties: { email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' } } } } } },
          responses: { 201: { description: 'Staff added' } },
        },
        get: {
          tags: ['Cooperatives'],
          summary: 'Get cooperative staff',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Staff list' } },
        },
      },
      '/cooperatives/{id}/items': {
        get: {
          tags: ['Cooperatives'],
          summary: 'Get items managed by cooperative',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Cooperative items' } },
        },
      },
      '/cooperative/dashboard': {
        get: {
          tags: ['Cooperatives'],
          summary: 'Get cooperative staff dashboard',
          description: 'For logged-in cooperative staff. Shows their cooperative stats and recent items.',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Dashboard data' } },
        },
      },

      // ============================
      // ADMIN
      // ============================
      '/admin/stats': {
        get: {
          tags: ['Admin'],
          summary: 'Get dashboard statistics',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Dashboard stats', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/DashboardStats' } } } } } } },
        },
      },
      '/admin/users': {
        get: {
          tags: ['Admin'],
          summary: 'List all users',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'role', in: 'query', schema: { type: 'string', enum: ['citizen', 'coop_staff', 'admin'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'banned'] } },
            { $ref: '#/components/parameters/PageParam' },
          ],
          responses: { 200: { description: 'Users list' } },
        },
      },
      '/admin/users/{userId}/ban': {
        post: {
          tags: ['Admin'],
          summary: 'Ban a user',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BanUserRequest' } } } },
          responses: { 200: { description: 'User banned' } },
        },
      },
      '/admin/users/{userId}/unban': {
        post: {
          tags: ['Admin'],
          summary: 'Unban a user',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'User unbanned' } },
        },
      },
      '/admin/scam-reports': {
        get: {
          tags: ['Admin'],
          summary: 'List scam reports',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'status', in: 'query', schema: { type: 'string', enum: ['OPEN', 'INVESTIGATING', 'RESOLVED'] } }],
          responses: { 200: { description: 'Scam reports' } },
        },
      },
      '/admin/scam-reports/{reportId}/resolve': {
        post: {
          tags: ['Admin'],
          summary: 'Resolve a scam report',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'reportId', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { resolution_notes: { type: 'string' }, action: { type: 'string', enum: ['dismiss', 'warn', 'suspend', 'ban'] } } } } } },
          responses: { 200: { description: 'Report resolved' } },
        },
      },
      '/admin/audit-logs': {
        get: {
          tags: ['Admin'],
          summary: 'View audit logs',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'actorId', in: 'query', schema: { type: 'integer' } },
            { name: 'action', in: 'query', schema: { type: 'string' } },
            { name: 'resourceType', in: 'query', schema: { type: 'string' } },
            { name: 'fromDate', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'toDate', in: 'query', schema: { type: 'string', format: 'date' } },
          ],
          responses: { 200: { description: 'Audit logs' } },
        },
      },
      '/admin/users/{userId}/recalculate-trust': {
        post: {
          tags: ['Admin'],
          summary: 'Recalculate user trust score',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Trust score recalculated' } },
        },
      },
      '/admin/cleanup': {
        post: {
          tags: ['Admin'],
          summary: 'Trigger manual cleanup',
          description: 'Manually runs the daily expiry and cleanup job.',
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: 'Cleanup completed' } },
        },
      },

      // ============================
      // SYSTEM
      // ============================
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: 'Returns server and database connectivity status.',
          responses: {
            200: { description: 'Healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' }, timestamp: { type: 'string', format: 'date-time' }, database: { type: 'string', example: 'connected' } } } } } },
            503: { description: 'Database unreachable' },
          },
        },
      },
    },
  },
  apis: [], // We define everything inline above
};

export const swaggerSpec = swaggerJsdoc(options);