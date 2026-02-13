import {
  hashPassword, verifyPassword, hashSecretAnswer, verifySecretAnswer,
  generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken,
  generateOTP, hashOTP, verifyOTP, extractKeywords, parsePaginationParams,
  detectExtortionKeywords, hashToken, generateUUID,
} from '../../src/utils';
import { UserRole } from '../../src/types';

describe('Password Hashing', () => {
  it('should hash and verify correctly', async () => {
    const hash = await hashPassword('MySecure1Pass');
    expect(hash).not.toBe('MySecure1Pass');
    expect(await verifyPassword('MySecure1Pass', hash)).toBe(true);
    expect(await verifyPassword('WrongPassword', hash)).toBe(false);
  });

  it('should produce unique hashes (random salt)', async () => {
    const h1 = await hashPassword('same');
    const h2 = await hashPassword('same');
    expect(h1).not.toBe(h2);
  });
});

describe('Secret Answer Hashing', () => {
  it('should verify case-insensitively with whitespace normalization', async () => {
    const { hash, salt } = await hashSecretAnswer('My Dog Buddy');
    expect(await verifySecretAnswer('my dog buddy', hash, salt)).toBe(true);
    expect(await verifySecretAnswer('MY DOG BUDDY', hash, salt)).toBe(true);
    expect(await verifySecretAnswer('  My  Dog  Buddy  ', hash, salt)).toBe(true);
  });

  it('should reject wrong answers', async () => {
    const { hash, salt } = await hashSecretAnswer('correct');
    expect(await verifySecretAnswer('wrong', hash, salt)).toBe(false);
  });

  it('should strip punctuation', async () => {
    const { hash, salt } = await hashSecretAnswer("it's blue!");
    expect(await verifySecretAnswer('its blue', hash, salt)).toBe(true);
  });
});

describe('JWT Tokens', () => {
  const payload = { userId: 1, email: 'test@example.com', role: UserRole.CITIZEN };

  it('should generate and verify access token', () => {
    const token = generateAccessToken(payload);
    expect(token.split('.')).toHaveLength(3);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(1);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('citizen');
  });

  it('should generate and verify refresh token', () => {
    const token = generateRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(1);
  });

  it('should reject invalid tokens', () => {
    expect(() => verifyAccessToken('invalid.token')).toThrow();
  });

  it('should reject tampered tokens', () => {
    const token = generateAccessToken(payload);
    expect(() => verifyAccessToken(token.slice(0, -3) + 'XXX')).toThrow();
  });

  it('should include iat and exp', () => {
    const decoded = verifyAccessToken(generateAccessToken(payload));
    expect(decoded).toHaveProperty('iat');
    expect(decoded).toHaveProperty('exp');
    expect(decoded.exp! - decoded.iat!).toBe(900); // 15 min
  });
});

describe('OTP Generation', () => {
  it('should generate 6-digit numeric OTP', () => {
    expect(generateOTP()).toMatch(/^\d{6}$/);
  });

  it('should produce mostly unique values', () => {
    const set = new Set(Array.from({ length: 100 }, generateOTP));
    expect(set.size).toBeGreaterThan(85);
  });

  it('should hash and verify OTP', async () => {
    const otp = '123456';
    const hash = await hashOTP(otp);
    expect(await verifyOTP('123456', hash)).toBe(true);
    expect(await verifyOTP('654321', hash)).toBe(false);
  });
});

describe('Keyword Extraction', () => {
  it('should extract meaningful keywords', () => {
    const kw = extractKeywords('Samsung Galaxy S23 black phone blue case');
    expect(kw).toContain('samsung');
    expect(kw).toContain('galaxy');
    expect(kw).toContain('black');
    expect(kw).toContain('blue');
  });

  it('should filter stop words', () => {
    const kw = extractKeywords('I lost my phone on the bus');
    expect(kw).not.toContain('i');
    expect(kw).not.toContain('my');
    expect(kw).not.toContain('the');
    expect(kw).toContain('phone');
    expect(kw).toContain('bus');
  });

  it('should handle empty input', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('should deduplicate', () => {
    const kw = extractKeywords('phone phone phone');
    expect(kw.filter(k => k === 'phone')).toHaveLength(1);
  });
});

describe('Pagination', () => {
  it('should parse valid params', () => {
    const r = parsePaginationParams('3', '10');
    expect(r).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('should default missing values', () => {
    const r = parsePaginationParams(undefined, undefined);
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
    expect(r.offset).toBe(0);
  });

  it('should clamp minimum page to 1', () => {
    expect(parsePaginationParams('0', '10').page).toBe(1);
    expect(parsePaginationParams('-1', '10').page).toBe(1);
  });
});

describe('Extortion Detection', () => {
  it('should detect extortion keywords', () => {
    expect(detectExtortionKeywords('send me money first')).toHaveLength(1);
    expect(detectExtortionKeywords('pay before I give it back')).toHaveLength(1);
  });

  it('should return empty for normal messages', () => {
    expect(detectExtortionKeywords('Hi, when can we meet?')).toHaveLength(0);
    expect(detectExtortionKeywords('I found your phone at KBS')).toHaveLength(0);
  });
});

describe('Utility Functions', () => {
  it('hashToken should produce consistent SHA-256', () => {
    const h1 = hashToken('test');
    const h2 = hashToken('test');
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64); // SHA-256 hex
  });

  it('generateUUID should produce valid UUIDs', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});