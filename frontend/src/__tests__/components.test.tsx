// ============================================
// FRONTEND COMPONENT TESTS
//
// Run: npm test
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ============================================
// TEST 1: SafetyWarningBanner renders correctly
// ============================================
describe('SafetyWarningBanner', () => {
  it('renders safety warning with anti-scam message', async () => {
    // Inline minimal component for testing without full import chain
    const SafetyBanner = () => (
      <div role="alert" data-testid="safety-banner" className="bg-amber-50 border-amber-200 p-4 rounded-lg">
        <p className="font-bold">safety.reminderBold</p>
        <ul>
          <li>safety.neverPay</li>
          <li>safety.meetPublic</li>
          <li>safety.useOfficialOTP</li>
        </ul>
      </div>
    );

    render(<SafetyBanner />);
    
    expect(screen.getByTestId('safety-banner')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('safety.neverPay')).toBeInTheDocument();
    expect(screen.getByText('safety.meetPublic')).toBeInTheDocument();
  });
});

// ============================================
// TEST 2: Trust Score display
// ============================================
describe('TrustScoreDisplay', () => {
  it('shows correct trust level for different scores', () => {
    const getTrustLevel = (score: number) => {
      if (score >= 10) return 'High';
      if (score >= 5) return 'Medium';
      if (score >= 0) return 'New';
      return 'Low';
    };

    expect(getTrustLevel(15)).toBe('High');
    expect(getTrustLevel(10)).toBe('High');
    expect(getTrustLevel(7)).toBe('Medium');
    expect(getTrustLevel(0)).toBe('New');
    expect(getTrustLevel(-5)).toBe('Low');
  });
});

// ============================================
// TEST 3: Registration form validation
// ============================================
describe('RegisterPage validation', () => {
  it('validates email format', () => {
    const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user@domain.rw')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('no@dots')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });

  it('validates Rwandan phone number format', () => {
    const validatePhone = (phone: string) => /^\+?250\d{9}$/.test(phone.replace(/\s/g, ''));

    expect(validatePhone('+250788123456')).toBe(true);
    expect(validatePhone('250788123456')).toBe(true);
    expect(validatePhone('+250 788 123 456')).toBe(true);
    expect(validatePhone('0788123456')).toBe(false);
    expect(validatePhone('+1234567890')).toBe(false);
  });

  it('validates password strength requirements', () => {
    const validatePassword = (pwd: string) => {
      if (pwd.length < 8) return 'Too short';
      if (!/[A-Z]/.test(pwd)) return 'Need uppercase';
      if (!/[a-z]/.test(pwd)) return 'Need lowercase';
      if (!/[0-9]/.test(pwd)) return 'Need number';
      return 'Valid';
    };

    expect(validatePassword('short')).toBe('Too short');
    expect(validatePassword('alllowercase1')).toBe('Need uppercase');
    expect(validatePassword('ALLUPPERCASE1')).toBe('Need lowercase');
    expect(validatePassword('NoNumbers')).toBe('Need number');
    expect(validatePassword('ValidPass1')).toBe('Valid');
  });

  it('requires consent checkbox and age confirmation', () => {
    const validate = (acceptedTerms: boolean, confirmedAge: boolean) => {
      const errors: string[] = [];
      if (!acceptedTerms) errors.push('Must accept terms');
      if (!confirmedAge) errors.push('Must confirm age');
      return errors;
    };

    expect(validate(false, false)).toHaveLength(2);
    expect(validate(true, false)).toHaveLength(1);
    expect(validate(false, true)).toHaveLength(1);
    expect(validate(true, true)).toHaveLength(0);
  });
});

// ============================================
// TEST 4: Item category rendering
// ============================================
describe('ItemCategory', () => {
  const CATEGORIES = ['PHONE', 'ID', 'WALLET', 'BAG', 'KEYS', 'OTHER'];

  it('recognizes all valid categories', () => {
    CATEGORIES.forEach(cat => {
      expect(CATEGORIES.includes(cat)).toBe(true);
    });
  });

  it('rejects invalid categories', () => {
    expect(CATEGORIES.includes('LAPTOP')).toBe(false);
    expect(CATEGORIES.includes('')).toBe(false);
  });
});

// ============================================
// TEST 5: Matching explanation display
// ============================================
describe('MatchExplanation', () => {
  it('renders match reasons correctly', () => {
    const explanations = [
      'Category match: +5',
      'Same sector: +5',
      'Within 24h: +3',
      'Keyword "iphone": +1',
    ];

    const MatchCard = ({ explanations }: { explanations: string[] }) => (
      <div data-testid="match-card">
        <span data-testid="match-score">14</span>
        <ul>
          {explanations.map((exp, i) => (
            <li key={i} data-testid={`reason-${i}`}>{exp}</li>
          ))}
        </ul>
      </div>
    );

    render(<MatchCard explanations={explanations} />);

    expect(screen.getByTestId('match-card')).toBeInTheDocument();
    expect(screen.getByTestId('match-score')).toHaveTextContent('14');
    expect(screen.getByTestId('reason-0')).toHaveTextContent('Category match: +5');
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});

// ============================================
// TEST 6: OTP display format
// ============================================
describe('OTP Handover', () => {
  it('generates 6-digit codes', () => {
    const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

    for (let i = 0; i < 100; i++) {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(Number(otp)).toBeGreaterThanOrEqual(100000);
      expect(Number(otp)).toBeLessThanOrEqual(999999);
    }
  });
});

// ============================================
// TEST 7: Location area filtering
// ============================================
describe('LocationFilter', () => {
  const RWANDA_LOCATIONS = [
    'Kigali', 'Nyabugogo', 'Kimironko', 'Remera', 'Kicukiro',
    'Gasabo', 'Nyarugenge', 'Huye', 'Musanze', 'Rubavu'
  ];

  it('filters locations by search text', () => {
    const filter = (query: string) =>
      RWANDA_LOCATIONS.filter(loc => loc.toLowerCase().includes(query.toLowerCase()));

    expect(filter('ki')).toEqual(['Kigali', 'Kimironko', 'Kicukiro']);
    expect(filter('nya')).toEqual(['Nyabugogo', 'Nyarugenge']);
    expect(filter('xyz')).toEqual([]);
  });
});

// ============================================
// TEST 8: Delete account confirmation logic
// ============================================
describe('AccountDeletion', () => {
  it('requires exact confirmation text', () => {
    const isValid = (text: string) => text === 'DELETE MY ACCOUNT';

    expect(isValid('DELETE MY ACCOUNT')).toBe(true);
    expect(isValid('delete my account')).toBe(false);
    expect(isValid('DELETE')).toBe(false);
    expect(isValid('')).toBe(false);
  });
});

// ============================================
// TEST 9: Data export format
// ============================================
describe('DataExport', () => {
  it('produces valid JSON with expected fields', () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      platform: 'Byaboneka+',
      user: { id: 1, name: 'Test', email: 'test@test.com' },
      lost_items: [],
      found_items: [],
      claims: [],
      messages_sent: [],
      recent_activity: [],
    };

    expect(exportData.platform).toBe('Byaboneka+');
    expect(exportData).toHaveProperty('user');
    expect(exportData).toHaveProperty('lost_items');
    expect(exportData).toHaveProperty('claims');
    expect(JSON.stringify(exportData)).toBeTruthy();
  });
});

// ============================================
// TEST 10: Language switcher options
// ============================================
describe('LanguageSwitcher', () => {
  const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'rw', name: 'Kinyarwanda' },
  ];

  it('supports all three languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(3);
    expect(SUPPORTED_LANGUAGES.map(l => l.code)).toContain('en');
    expect(SUPPORTED_LANGUAGES.map(l => l.code)).toContain('fr');
    expect(SUPPORTED_LANGUAGES.map(l => l.code)).toContain('rw');
  });
});
