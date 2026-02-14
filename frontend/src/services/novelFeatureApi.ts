/**
 * ============================================
 * API METHODS FOR NOVEL FEATURES
 * ============================================
 * 
 * Add to: frontend/src/services/novelFeatureApi.ts
 * 
 * Uses the existing default-exported axios instance from api.ts.
 */

import api from './api';

// ============================================
// VERIFICATION STRENGTH API
// ============================================

export const verificationStrengthApi = {
  /** Analyze question quality before saving */
  analyzeStrength: (data: {
    questions: string[];
    answers: string[];
    category: string;
    description: string;
  }) => api.post('/verification/analyze-strength', data),

  /** Get suggested templates for a category */
  getTemplates: (category: string) => 
    api.get(`/verification/templates/${category}`),

  /** Get all templates grouped by category */
  getAllTemplates: () => 
    api.get('/verification/templates'),
};

// ============================================
// COOPERATIVE LEADERBOARD API
// ============================================

export const cooperativeLeaderboardApi = {
  /** Public: get all cooperatives ranked by accountability */
  getLeaderboard: () => 
    api.get('/cooperatives/leaderboard'),

  /** Get detailed accountability report for one cooperative */
  getAccountability: (cooperativeId: number) => 
    api.get(`/cooperatives/${cooperativeId}/accountability`),
};

// ============================================
// SAFE HANDOVER LOCATIONS API
// ============================================

export const handoverLocationsApi = {
  /** Get all safe handover locations */
  getAllLocations: () => 
    api.get('/handover/safe-locations'),

  /** Get recommended locations for a specific area and item type */
  getRecommended: (area: string, category: string) =>
    api.get('/handover/recommended-locations', {
      params: { area, category }
    }),
};

// ============================================
// PRIVACY REDACTION API (admin/testing)
// ============================================

export const privacyApi = {
  /** Preview what redaction would do to text */
  previewRedaction: (text: string, category?: string) =>
    api.post('/privacy/preview-redaction', { text, category }),
};

// ============================================
// FRAUD DETECTION API (admin only)
// ============================================

export const fraudApi = {
  /** Get users flagged by fraud detection */
  getFlaggedUsers: () =>
    api.get('/admin/fraud/flagged-users'),
};