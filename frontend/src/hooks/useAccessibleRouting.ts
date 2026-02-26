import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Focus management hook for accessibility.
 * 
 * On every route change:
 * 1. Moves focus to main content (for screen readers)
 * 2. Updates document title (for tab identification)
 * 3. Scrolls to top (already handled by ScrollToTop component)
 */

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home — Byaboneka+',
  '/login': 'Sign In — Byaboneka+',
  '/register': 'Create Account — Byaboneka+',
  '/forgot-password': 'Reset Password — Byaboneka+',
  '/dashboard': 'Dashboard — Byaboneka+',
  '/search': 'Search Items — Byaboneka+',
  '/report-lost': 'Report Lost Item — Byaboneka+',
  '/report-found': 'Report Found Item — Byaboneka+',
  '/my-items': 'My Items — Byaboneka+',
  '/messages': 'Messages — Byaboneka+',
  '/settings': 'Settings — Byaboneka+',
  '/about': 'About — Byaboneka+',
  '/contact': 'Contact Us — Byaboneka+',
  '/privacy': 'Privacy Policy — Byaboneka+',
  '/terms': 'Terms of Service — Byaboneka+',
  '/leaderboard': 'Cooperative Leaderboard — Byaboneka+',
  '/admin': 'Admin Dashboard — Byaboneka+',
  '/admin/users': 'Manage Users — Byaboneka+',
  '/admin/fraud': 'Fraud Detection — Byaboneka+',
  '/admin/scam-reports': 'Scam Reports — Byaboneka+',
  '/cooperative': 'Cooperative Dashboard — Byaboneka+',
};

export function useAccessibleRouting(): void {
  const location = useLocation();

  useEffect(() => {
    // Update document title
    const title = PAGE_TITLES[location.pathname] || 'Byaboneka+';
    document.title = title;

    // Move focus to main content for screen readers
    const main = document.getElementById('main-content');
    if (main) {
      main.focus({ preventScroll: true });
    }
  }, [location.pathname]);
}

export default useAccessibleRouting;

// ============================================
// INTEGRATION:
// In your App.tsx or router wrapper:
//
// import { useAccessibleRouting } from './hooks/useAccessibleRouting';
//
// function AppRoutes() {
//   useAccessibleRouting();
//   return <Routes>...</Routes>;
// }
// ============================================
