// ============================================
// FRONTEND TEST SETUP
// File: src/__tests__/setup.ts
// ============================================

import React from 'react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ✅ remove this (it breaks parsing/types)
// import { a } from 'vitest/dist/reporters-w_64AS5f.js';

// Mock react-router-dom (NO JSX here)
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],

    // ✅ No JSX in .ts: use React.createElement instead
    Link: ({ children, to, ...props }: any) =>
      React.createElement('a', { href: to, ...props }, children),
  };
});

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'en' },
  }),
  Trans: ({ children }: any) => children,
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock zustand store
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      name: 'Test User',
      email: 'test@test.com',
      role: 'citizen',
      trust_score: 5,
      email_verified: true,
      phone_verified: false,
    },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    accessToken: 'mock-token',
    refreshToken: 'mock-refresh',
  }),
}));

// Mock recaptcha hook
vi.mock('../hooks/useRecaptcha', () => ({
  useRecaptcha: () => ({
    executeRecaptcha: vi.fn().mockResolvedValue('mock-recaptcha-token'),
  }),
}));