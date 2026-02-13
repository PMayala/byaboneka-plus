import {
  registerSchema, loginSchema, createLostItemSchema, createFoundItemSchema,
  createClaimSchema, verifyClaimSchema, verifyOtpSchema, sendMessageSchema,
  createCooperativeSchema, banUserSchema,
} from '../../src/middleware/validation';

describe('Register Schema', () => {
  const valid = { email: 'test@example.com', password: 'MySecure1P', name: 'Jean' };

  it('should accept valid registration', () => {
    expect(() => registerSchema.parse(valid)).not.toThrow();
  });

  it('should accept with optional phone', () => {
    expect(() => registerSchema.parse({ ...valid, phone: '+250788123456' })).not.toThrow();
  });

  it('should reject invalid email', () => {
    expect(() => registerSchema.parse({ ...valid, email: 'not-email' })).toThrow();
  });

  it('should reject weak password (no uppercase)', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'nouppercase1' })).toThrow();
  });

  it('should reject weak password (no number)', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'NoNumberHere' })).toThrow();
  });

  it('should reject short password', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'Ab1' })).toThrow();
  });

  it('should reject short name', () => {
    expect(() => registerSchema.parse({ ...valid, name: 'J' })).toThrow();
  });

  it('should reject invalid Rwandan phone', () => {
    expect(() => registerSchema.parse({ ...valid, phone: '+1234567890' })).toThrow();
  });
});

describe('Login Schema', () => {
  it('should accept valid login', () => {
    expect(() => loginSchema.parse({ email: 'a@b.com', password: 'x' })).not.toThrow();
  });

  it('should reject missing email', () => {
    expect(() => loginSchema.parse({ password: 'x' })).toThrow();
  });
});

describe('Create Lost Item Schema', () => {
  const valid = {
    category: 'PHONE',
    title: 'Lost Samsung',
    description: 'Black Samsung phone with blue case found on bus',
    location_area: 'Nyabugogo',
    lost_date: '2026-02-10T14:00:00Z',
    verification_questions: [
      { question: 'What is the wallpaper?', answer: 'my dog' },
      { question: 'What color is the case?', answer: 'blue' },
      { question: 'What is the PIN?', answer: 'six' },
    ],
  };

  it('should accept valid lost item', () => {
    expect(() => createLostItemSchema.parse(valid)).not.toThrow();
  });

  it('should reject invalid category', () => {
    expect(() => createLostItemSchema.parse({ ...valid, category: 'CAR' })).toThrow();
  });

  it('should reject less than 3 questions', () => {
    expect(() => createLostItemSchema.parse({
      ...valid,
      verification_questions: valid.verification_questions.slice(0, 2),
    })).toThrow();
  });

  it('should reject more than 3 questions', () => {
    expect(() => createLostItemSchema.parse({
      ...valid,
      verification_questions: [...valid.verification_questions, { question: 'Extra?', answer: 'x' }],
    })).toThrow();
  });

  it('should reject short title', () => {
    expect(() => createLostItemSchema.parse({ ...valid, title: 'AB' })).toThrow();
  });

  it('should reject short description', () => {
    expect(() => createLostItemSchema.parse({ ...valid, description: 'Too short' })).toThrow();
  });

  it('should accept ISO date string', () => {
    expect(() => createLostItemSchema.parse({ ...valid, lost_date: '2026-02-10' })).not.toThrow();
  });
});

describe('Create Found Item Schema', () => {
  const valid = {
    category: 'WALLET',
    title: 'Brown leather wallet',
    description: 'Found brown wallet at bus stop with some cash inside',
    location_area: 'Kimironko',
    found_date: '2026-02-10T16:00:00Z',
  };

  it('should accept valid found item', () => {
    expect(() => createFoundItemSchema.parse(valid)).not.toThrow();
  });

  it('should accept optional cooperative_id', () => {
    expect(() => createFoundItemSchema.parse({ ...valid, cooperative_id: 1 })).not.toThrow();
  });
});

describe('Claim Schemas', () => {
  it('should accept valid claim', () => {
    expect(() => createClaimSchema.parse({ lost_item_id: 1, found_item_id: 2 })).not.toThrow();
  });

  it('should reject non-positive IDs', () => {
    expect(() => createClaimSchema.parse({ lost_item_id: 0, found_item_id: 2 })).toThrow();
    expect(() => createClaimSchema.parse({ lost_item_id: 1, found_item_id: -1 })).toThrow();
  });

  it('should accept valid verification answers (3 strings)', () => {
    expect(() => verifyClaimSchema.parse({ answers: ['a', 'b', 'c'] })).not.toThrow();
  });

  it('should reject wrong number of answers', () => {
    expect(() => verifyClaimSchema.parse({ answers: ['a', 'b'] })).toThrow();
    expect(() => verifyClaimSchema.parse({ answers: ['a', 'b', 'c', 'd'] })).toThrow();
  });

  it('should reject empty answers', () => {
    expect(() => verifyClaimSchema.parse({ answers: ['', 'b', 'c'] })).toThrow();
  });
});

describe('OTP Schema', () => {
  it('should accept valid 6-digit OTP', () => {
    expect(() => verifyOtpSchema.parse({ otp: '123456' })).not.toThrow();
  });

  it('should reject non-numeric', () => {
    expect(() => verifyOtpSchema.parse({ otp: 'abcdef' })).toThrow();
  });

  it('should reject wrong length', () => {
    expect(() => verifyOtpSchema.parse({ otp: '12345' })).toThrow();
    expect(() => verifyOtpSchema.parse({ otp: '1234567' })).toThrow();
  });
});

describe('Message Schema', () => {
  it('should accept valid message', () => {
    expect(() => sendMessageSchema.parse({ content: 'Hello!' })).not.toThrow();
  });

  it('should reject empty message', () => {
    expect(() => sendMessageSchema.parse({ content: '' })).toThrow();
  });

  it('should reject too long message', () => {
    expect(() => sendMessageSchema.parse({ content: 'x'.repeat(1001) })).toThrow();
  });
});

describe('Cooperative Schema', () => {
  it('should accept valid cooperative', () => {
    expect(() => createCooperativeSchema.parse({
      name: 'KBS Cooperative',
      registration_number: 'RW-2024-001',
      contact_info: '+250788000111',
    })).not.toThrow();
  });
});

describe('Ban User Schema', () => {
  it('should accept valid ban reason', () => {
    expect(() => banUserSchema.parse({ reason: 'Repeated fraud' })).not.toThrow();
  });

  it('should reject short reason', () => {
    expect(() => banUserSchema.parse({ reason: 'bad' })).toThrow();
  });
});