import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, X, Search, Bell, User, LogOut, 
  Home, FileText, Package, MessageSquare, Settings,
  Shield, ChevronDown, Trophy
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api';
import toast from 'react-hot-toast';

// ============================================
// HEADER
// ============================================

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Continue with logout even if API call fails
    }
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/report-lost', label: 'Report Lost', icon: FileText },
    { href: '/report-found', label: 'Report Found', icon: Package },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">B+</span>
            </div>
            <span className="font-bold text-xl text-primary-500 hidden sm:block">
              Byaboneka+
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <Link 
                  to="/messages" 
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg relative"
                >
                  <Bell className="w-5 h-5" />
                </Link>

                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700">
                      {user?.name?.split(' ')[0]}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {profileMenuOpen && (
                    <>
                      <div 
                        className="fixed inset-0" 
                        onClick={() => setProfileMenuOpen(false)} 
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-fade-in">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                          <p className="text-xs text-gray-500">{user?.email}</p>
                          <div className="flex items-center mt-1">
                            <Shield className="w-3 h-3 text-trust-500 mr-1" />
                            <span className="text-xs text-trust-600">
                              Trust Score: {user?.trust_score}
                            </span>
                          </div>
                        </div>
                        <Link
                          to="/dashboard"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          <Home className="w-4 h-4 mr-3" />
                          Dashboard
                        </Link>
                        <Link
                          to="/my-items"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          <Package className="w-4 h-4 mr-3" />
                          My Items
                        </Link>
                        <Link
                          to="/messages"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          <MessageSquare className="w-4 h-4 mr-3" />
                          Messages
                        </Link>
                        <Link
                          to="/settings"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setProfileMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4 mr-3" />
                          Settings
                        </Link>
                        {user?.role === 'admin' && (
                          <Link
                            to="/admin"
                            className="flex items-center px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <Shield className="w-4 h-4 mr-3" />
                            Admin Panel
                          </Link>
                        )}
                        {user?.role === 'coop_staff' && (
                          <Link
                            to="/coop"
                            className="flex items-center px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                            onClick={() => setProfileMenuOpen(false)}
                          >
                            <Package className="w-4 h-4 mr-3" />
                            Cooperative
                          </Link>
                        )}
                        <div className="border-t border-gray-100 mt-2 pt-2">
                          <button
                            onClick={handleLogout}
                            className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <LogOut className="w-4 h-4 mr-3" />
                            Logout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Sign up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 animate-fade-in">
            <nav className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    'flex items-center px-4 py-3 rounded-lg text-sm font-medium',
                    isActive(link.href)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <link.icon className="w-5 h-5 mr-3" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

// ============================================
// FOOTER (FIX: All links now point to real pages)
// ============================================

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">B+</span>
              </div>
              <span className="font-bold text-xl text-primary-500">Byaboneka+</span>
            </div>
            <p className="text-gray-600 text-sm max-w-md">
              Trust-Aware Lost & Found Infrastructure for Rwanda's Transport Ecosystem. 
              Helping reunite people with their belongings securely.
            </p>
          </div>

          {/* Quick Links - FIX: Updated to point to real pages */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/search" className="text-sm text-gray-600 hover:text-primary-500">Search Items</Link></li>
              <li><Link to="/report-lost" className="text-sm text-gray-600 hover:text-primary-500">Report Lost</Link></li>
              <li><Link to="/report-found" className="text-sm text-gray-600 hover:text-primary-500">Report Found</Link></li>
              <li><Link to="/how-it-works" className="text-sm text-gray-600 hover:text-primary-500">How It Works</Link></li>
              <li><Link to="/leaderboard" className="text-sm text-gray-600 hover:text-primary-500">Leaderboard</Link></li>
            </ul>
          </div>

          {/* Support - FIX: Updated to point to real pages */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
            <ul className="space-y-2">
              <li><Link to="/faq" className="text-sm text-gray-600 hover:text-primary-500">FAQ</Link></li>
              <li><Link to="/contact" className="text-sm text-gray-600 hover:text-primary-500">Contact Us</Link></li>
              <li><Link to="/privacy" className="text-sm text-gray-600 hover:text-primary-500">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-sm text-gray-600 hover:text-primary-500">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Byaboneka+. ALU Mission Capstone Project.
          </p>
        </div>
      </div>
    </footer>
  );
};

// ============================================
// LAYOUT
// ============================================

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};