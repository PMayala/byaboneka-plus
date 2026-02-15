import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Smoothly scroll to the top on route change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null; // This component doesn't render anything
};

export default ScrollToTop;