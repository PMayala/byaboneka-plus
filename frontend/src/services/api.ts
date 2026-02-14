import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '../store/authStore';
import { User, LostItem, FoundItem, Claim, Message, Cooperative, MessageThread } from '../types';

// ============================================
// CONFIGURATION
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// ============================================
// API RESPONSE TYPES
// ============================================

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// ============================================
// CREATE AXIOS INSTANCE
// ============================================

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// ============================================
// RETRY LOGIC
// ============================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error: AxiosError): boolean => {
  if (!error.response) return true;
  const status = error.response.status;
  return status >= 500 && status <= 599;
};

// ============================================
// REQUEST INTERCEPTOR
// ============================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    (config as any).metadata = { startTime: new Date() };
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================

api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      const startTime = (response.config as any).metadata?.startTime;
      if (startTime) {
        const duration = new Date().getTime() - startTime.getTime();
        console.debug(`${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          useAuthStore.getState().logout();
          
          if (typeof window !== 'undefined') {
            window.location.href = '/login?session_expired=true';
          }
          return Promise.reject(refreshError);
        }
      } else {
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    if (error.response?.status === 429) {
      console.warn('Rate limited. Please slow down.');
    }

    if (!error.response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================
// ERROR HELPER
// ============================================

export const getErrorMessage = (error: any): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message || 'An error occurred';
  }
  return error?.message || 'An unexpected error occurred';
};

// ============================================
// AUTH API
// ============================================

export const authApi = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    api.post<ApiResponse<LoginResponse>>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', data),

  logout: () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    return api.post<ApiResponse>('/auth/logout', { refreshToken });
  },

  refreshToken: (refreshToken: string) =>
    api.post<ApiResponse<AuthTokens>>('/auth/refresh', { refreshToken }),

  forgotPassword: (email: string) =>
    api.post<ApiResponse>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<ApiResponse>('/auth/reset-password', { token, password }),

  getProfile: () =>
    api.get<ApiResponse<User>>('/auth/profile'),

  updateProfile: (data: { name?: string; phone?: string }) =>
    api.put<ApiResponse<User>>('/auth/profile', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<ApiResponse>('/auth/change-password', data),
};

// ============================================
// EMAIL VERIFICATION API (FIX #10 - was missing)
// ============================================

export const emailVerificationApi = {
  requestVerification: () =>
    api.post<ApiResponse<{ message: string }>>('/auth/email/verify/request'),

  verify: (token: string) =>
    api.post<ApiResponse<{ verified: boolean }>>('/auth/email/verify', { token }),

  getStatus: () =>
    api.get<ApiResponse<{ email_verified: boolean }>>('/auth/email/status'),
};

// ============================================
// LOST ITEMS API
// ============================================

export interface CreateLostItemData {
  category: string;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  lost_date: string;
  verification_questions: Array<{ question: string; answer: string }>;
}

export interface UpdateLostItemData {
  title?: string;
  description?: string;
  location_area?: string;
  location_hint?: string;
  status?: string;
}

export const lostItemsApi = {
  create: (data: CreateLostItemData) =>
    api.post<ApiResponse<LostItem>>('/lost-items', data),

  getAll: (params?: { page?: number; limit?: number; category?: string; location_area?: string; keyword?: string }) =>
    api.get<PaginatedResponse<LostItem>>('/lost-items', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<LostItem>>(`/lost-items/${id}`),

  update: (id: number, data: UpdateLostItemData) =>
    api.put<ApiResponse<LostItem>>(`/lost-items/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse>(`/lost-items/${id}`),

  getMatches: (id: number) =>
    api.get<ApiResponse<Array<{ found_item: FoundItem; score: number; explanation: string[] }>>>(`/lost-items/${id}/matches`),

  getMine: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<LostItem>>('/users/me/lost-items', { params }),
};

// ============================================
// FOUND ITEMS API
// ============================================

export interface CreateFoundItemData {
  category: string;
  title: string;
  description: string;
  location_area: string;
  location_hint?: string;
  found_date: string;
  cooperative_id?: number;
}

export interface UpdateFoundItemData {
  title?: string;
  description?: string;
  location_area?: string;
  location_hint?: string;
  status?: string;
}

export const foundItemsApi = {
  create: (data: CreateFoundItemData) =>
    api.post<ApiResponse<FoundItem>>('/found-items', data),

  getAll: (params?: { page?: number; limit?: number; category?: string; location_area?: string; keyword?: string }) =>
    api.get<PaginatedResponse<FoundItem>>('/found-items', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<FoundItem>>(`/found-items/${id}`),

  update: (id: number, data: UpdateFoundItemData) =>
    api.put<ApiResponse<FoundItem>>(`/found-items/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse>(`/found-items/${id}`),

  uploadImages: (id: number, files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });
    return api.post<ApiResponse<{ image_urls: string[] }>>(`/found-items/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },

  getMatches: (id: number) =>
    api.get<ApiResponse<Array<{ lost_item: LostItem; score: number; explanation: string[] }>>>(`/found-items/${id}/matches`),

  getMine: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<FoundItem>>('/users/me/found-items', { params }),
};

// ============================================
// DUPLICATE DETECTION API (FIX #9 - was missing)
// ============================================

export const duplicateApi = {
  checkLost: (data: { category: string; title: string; description: string; location_area: string; lost_date: string }) =>
    api.post<ApiResponse<{
      has_potential_duplicates: boolean;
      candidates: Array<{
        id: number;
        title: string;
        description: string;
        category: string;
        location_area: string;
        date: string;
        similarity_score: number;
        similarity_reasons: string[];
      }>;
      highest_score: number;
    }>>('/lost-items/check-duplicate', data),

  checkFound: (data: { category: string; title: string; description: string; location_area: string; found_date: string }) =>
    api.post<ApiResponse<{
      has_potential_duplicates: boolean;
      candidates: Array<{
        id: number;
        title: string;
        description: string;
        category: string;
        location_area: string;
        date: string;
        similarity_score: number;
        similarity_reasons: string[];
      }>;
      highest_score: number;
    }>>('/found-items/check-duplicate', data),
};

// ============================================
// CLAIMS API
// ============================================

export const claimsApi = {
  create: (data: { lost_item_id: number; found_item_id: number }) =>
    api.post<ApiResponse<Claim>>('/claims', data),

  getById: (id: number) =>
    api.get<ApiResponse<Claim>>(`/claims/${id}`),

  getQuestions: (claimId: number) =>
    api.get<ApiResponse<{ claim_id: number; questions: string[]; attempts_remaining: number }>>(`/claims/${claimId}/questions`),

  verify: (claimId: number, answers: string[]) =>
    api.post<ApiResponse<{ verified: boolean; correct_count: number; attempts_remaining: number }>>(`/claims/${claimId}/verify`, { answers }),

  cancel: (claimId: number) =>
    api.post<ApiResponse>(`/claims/${claimId}/cancel`),

  getMine: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<Claim>>('/users/me/claims', { params }),

  // FIX #11 - Verification cooldown status
  getVerificationStatus: (claimId: number) =>
    api.get<ApiResponse>(`/claims/${claimId}/verification/status`),
};

// ============================================
// HANDOVER API (FIX #1 - URLs were completely wrong)
// Old: /handovers/:id/generate-otp  →  Fixed: /claims/:id/handover/otp
// Old: /handovers/:id/confirm       →  Fixed: /claims/:id/handover/verify
// ============================================

export const handoverApi = {
  generateOtp: (claimId: number) =>
    api.post<ApiResponse<{ otp: string; expires_at: string; validity_hours: number }>>(`/claims/${claimId}/handover/otp`),

  confirmHandover: (claimId: number, otp: string) =>
    api.post<ApiResponse<{ message: string; handover_completed: boolean }>>(`/claims/${claimId}/handover/verify`, { otp }),

  getStatus: (claimId: number) =>
    api.get<ApiResponse<{
      has_otp: boolean;
      otp_verified?: boolean;
      expires_at?: string;
      attempts_used?: number;
      is_expired?: boolean;
      message?: string;
    }>>(`/claims/${claimId}/handover`),
};

// ============================================
// DISPUTE API (FIX #8 - was completely missing)
// ============================================

export const disputeApi = {
  open: (claimId: number, data: { reason: string; evidence_urls?: string[] }) =>
    api.post<ApiResponse>(`/claims/${claimId}/dispute`, data),

  get: (claimId: number) =>
    api.get<ApiResponse<{
      id: number;
      claim_id: number;
      opened_by: number;
      reason: string;
      status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_OWNER' | 'RESOLVED_FINDER' | 'DISMISSED';
      evidence_urls: string[];
      resolution_notes?: string;
      resolved_by?: number;
      created_at: string;
      resolved_at?: string;
    }>>(`/claims/${claimId}/dispute`),

  addEvidence: (disputeId: number, evidence_urls: string[]) =>
    api.post<ApiResponse>(`/disputes/${disputeId}/evidence`, { evidence_urls }),
};

// ============================================
// MESSAGES API (FIX #3 - unread count key, FIX #6 - removed markAsRead)
// ============================================

export const messagesApi = {
  getThreads: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<MessageThread>>('/messages/threads', { params }),

  getMessages: (claimId: number, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<Message[]>>(`/messages/threads/${claimId}`, { params }),
    // NOTE: Backend auto-marks messages as read when fetched, no separate markAsRead needed

  sendMessage: (claimId: number, content: string) =>
    api.post<ApiResponse<Message>>(`/messages/threads/${claimId}`, { content }),

  reportScam: (messageId: number, reason: string) =>
    api.post<ApiResponse>(`/messages/${messageId}/report`, { reason }),

  // FIX #3: Backend returns { unread_count: number }, NOT { count: number }
  getUnreadCount: () =>
    api.get<ApiResponse<{ unread_count: number }>>('/messages/unread-count'),
};

// ============================================
// COOPERATIVES API
// ============================================

export const cooperativesApi = {
  getAll: (params?: { page?: number; limit?: number; verified?: boolean }) =>
    api.get<PaginatedResponse<Cooperative>>('/cooperatives', { params }),

  getById: (id: number) =>
    api.get<ApiResponse<Cooperative>>(`/cooperatives/${id}`),

  getDashboard: () =>
    api.get<ApiResponse<{
      cooperative: Cooperative;
      stats: { total_items: number; pending_claims: number; returned_items: number; active_staff: number };
      recent_items: FoundItem[];
    }>>('/cooperative/dashboard'),
};

// ============================================
// ADMIN API (FIX #2 - AdminStats type matched to real backend response)
// ============================================

// FIX #2: This now matches what the backend ACTUALLY returns
export interface AdminStats {
  total_users: number;
  total_lost_items: number;
  total_found_items: number;
  total_claims: number;
  successful_returns: number;
  pending_scam_reports: number;
}

// FIX #7: Status uses 'OPEN' not 'PENDING' to match backend
export interface ScamReport {
  id: number;
  reporter_id: number;
  reporter_name: string;
  reporter_email: string;
  reported_user_id: number;
  reported_name: string;
  reported_email: string;
  message_id: number;
  message_content: string;
  claim_id: number;
  reason: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  resolution_notes?: string;
  resolved_by?: number;
  resolved_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: number;
  actor_name: string;
  action: string;
  resource_type: string;
  resource_id: number;
  changes: any;
  ip_address: string;
  timestamp: string;
}

export const adminApi = {
  getStats: () =>
    api.get<ApiResponse<AdminStats>>('/admin/stats'),

  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; status?: string }) =>
    api.get<PaginatedResponse<User>>('/admin/users', { params }),

  banUser: (userId: number, reason: string) =>
    api.post<ApiResponse>(`/admin/users/${userId}/ban`, { reason }),

  unbanUser: (userId: number) =>
    api.post<ApiResponse>(`/admin/users/${userId}/unban`),

  recalculateTrust: (userId: number) =>
    api.post<ApiResponse<{ user_id: number; new_trust_score: number }>>(`/admin/users/${userId}/recalculate-trust`),

  getScamReports: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<ScamReport>>('/admin/scam-reports', { params }),

  resolveScamReport: (reportId: number, data: { resolution_notes: string; action: 'dismiss' | 'warn' | 'ban' }) =>
    api.post<ApiResponse>(`/admin/scam-reports/${reportId}/resolve`, data),

  getAuditLogs: (params?: { page?: number; limit?: number; action?: string; resourceType?: string; actorId?: number }) =>
    api.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params }),

  triggerCleanup: () =>
    api.post<ApiResponse<{ message: string }>>('/admin/cleanup'),

  // Admin dispute endpoints
  getDisputes: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<any>>('/admin/disputes', { params }),

  resolveDispute: (disputeId: number, data: { resolution: string; resolution_notes: string }) =>
    api.post<ApiResponse>(`/admin/disputes/${disputeId}/resolve`, data),
};

// ============================================
// HEALTH CHECK
// ============================================

export const healthApi = {
  check: () => api.get<{ status: string; timestamp: string; database: string }>('/health'),
};

export default api;