// ============================================
// SKIP TO CONTENT LINK
// File: src/components/SkipLink.tsx
// Gap Fix #10: Accessibility
// ============================================
// 
// Add this component at the TOP of your layout (before Header):
//   import { SkipLink } from '../components/SkipLink';
//   <SkipLink />
//   <Header />
//   <main id="main-content" tabIndex={-1}>
//     {children}
//   </main>
//   <Footer />

import React from 'react';

export const SkipLink: React.FC = () => (
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 
               focus:z-50 focus:bg-primary-600 focus:text-white focus:px-4 focus:py-2 
               focus:rounded-lg focus:text-sm focus:shadow-lg focus:outline-none"
  >
    Skip to main content
  </a>
);

export default SkipLink;
