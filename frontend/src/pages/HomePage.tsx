import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, Shield, MapPin, CheckCircle, ArrowRight, Users, 
  Package, FileText, Building2, TrendingUp, Clock, Star
} from 'lucide-react';
import { Button, Card, Badge } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { foundItemsApi, lostItemsApi } from '../services/api';
import { FoundItem, LostItem, CATEGORY_INFO, ItemCategory } from '../types';
import { formatDateShort } from '../utils/dateUtils';

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [recentFound, setRecentFound] = useState<FoundItem[]>([]);
  const [recentLost, setRecentLost] = useState<LostItem[]>([]);
  const [stats, setStats] = useState({ found: 0, lost: 0, returned: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [foundRes, lostRes] = await Promise.all([
        foundItemsApi.getAll({ limit: 4 }).catch(() => ({ data: { data: [], pagination: { total: 0 } } })),
        lostItemsApi.getAll({ limit: 4 }).catch(() => ({ data: { data: [], pagination: { total: 0 } } })),
      ]);
      setRecentFound(foundRes.data.data || []);
      setRecentLost(lostRes.data.data || []);
      setStats({
        found: foundRes.data.pagination?.total || 0,
        lost: lostRes.data.pagination?.total || 0,
        returned: Math.floor((foundRes.data.pagination?.total || 0) * 0.7),
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  // FIX: Search bar now passes the keyword to /search page
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('type', 'found');
    if (searchQuery.trim()) {
      params.set('keyword', searchQuery.trim());
    }
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iNCIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28 relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="verified" size="lg" className="mb-4 sm:mb-6">
              <Star className="w-4 h-4 mr-1" /> Trusted by 10,000+ Rwandans
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              Lost Something?{' '}
              <span className="text-accent-400">We'll Help You Find It</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-primary-100 mb-6 sm:mb-8 px-4">
              Rwanda's first trust-aware lost and found platform. Report lost items, find what others have found, and recover your belongings safely.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Link to="/report-lost">
                <Button size="lg" variant="accent" fullWidth className="sm:w-auto">
                  <FileText className="w-5 h-5" />
                  Report Lost Item
                </Button>
              </Link>
              <Link to="/search">
                <Button size="lg" variant="secondary" fullWidth className="sm:w-auto bg-white/10 border-white/30 text-white hover:bg-white/20">
                  <Search className="w-5 h-5" />
                  Search Found Items
                </Button>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
            {[
              { value: stats.lost + stats.found, label: 'Items Reported' },
              { value: stats.returned, label: 'Items Returned' },
              { value: '146+', label: 'Partner Coops' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className="text-xs sm:text-sm text-primary-200 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Search Bar - FIX: Now actually submits search query */}
      <section className="bg-white border-b sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <form onSubmit={handleSearch} className="flex gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for lost or found items..."
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
              />
            </div>
            <Button type="submit" size="md" className="hidden sm:flex">Search</Button>
            <Button type="submit" size="md" className="sm:hidden px-3"><Search className="w-5 h-5" /></Button>
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Why Choose Byaboneka+?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Built specifically for Rwanda's transport ecosystem with trust and security at its core</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: <Search className="w-7 h-7" />, title: 'Smart Matching', desc: 'AI matches lost & found items by location, time, and description', color: 'bg-blue-500' },
              { icon: <Shield className="w-7 h-7" />, title: 'Secure Verification', desc: 'Multi-question verification ensures rightful ownership', color: 'bg-green-500' },
              { icon: <Building2 className="w-7 h-7" />, title: 'Cooperative Network', desc: '146+ transport cooperatives across Rwanda', color: 'bg-purple-500' },
              { icon: <TrendingUp className="w-7 h-7" />, title: 'Trust System', desc: 'Build reputation through honest transactions', color: 'bg-orange-500' },
            ].map((feature, i) => (
              <Card key={i} className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center text-white mx-auto mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">How It Works</h2>
            <p className="text-gray-600">Simple 4-step process to recover your lost items</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { step: '01', title: 'Report', desc: 'Describe your lost/found item with details', icon: FileText },
              { step: '02', title: 'Match', desc: 'Our system finds potential matches', icon: Search },
              { step: '03', title: 'Verify', desc: 'Answer questions to prove ownership', icon: Shield },
              { step: '04', title: 'Return', desc: 'Complete handover with OTP code', icon: CheckCircle },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-8 h-8 text-primary-600" />
                  </div>
                  <span className="text-4xl font-bold text-primary-100">{item.step}</span>
                  <h3 className="font-semibold text-gray-900 mt-2 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%]">
                    <div className="border-t-2 border-dashed border-gray-200" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/how-it-works">
              <Button variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Recent Items */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Recently Reported</h2>
              <p className="text-gray-600">Latest items that need to find their owners</p>
            </div>
            <Link to="/search">
              <Button variant="outline" rightIcon={<ArrowRight className="w-4 h-4" />}>
                View All Items
              </Button>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...recentFound, ...recentLost].slice(0, 4).map((item, i) => {
              const isFound = 'finder_id' in item;
              return (
                <Link key={`${isFound ? 'f' : 'l'}-${item.id}`} to={`/${isFound ? 'found' : 'lost'}-items/${item.id}`}>
                  <Card hover className="overflow-hidden h-full">
                    <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                      {isFound && (item as FoundItem).image_urls?.length > 0 ? (
                        <img src={(item as FoundItem).image_urls[0]} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-4xl">{CATEGORY_INFO[item.category as ItemCategory]?.icon || '📦'}</span>
                      )}
                      <Badge variant={isFound ? 'verified' : 'pending'} className="absolute top-2 left-2">
                        {isFound ? 'Found' : 'Lost'}
                      </Badge>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{item.title}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                        <MapPin className="w-4 h-4" /> {item.location_area}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDateShort(isFound ? (item as FoundItem).found_date : (item as LostItem).lost_date)}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-primary-600 to-primary-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-primary-100 mb-8 text-base sm:text-lg">Join thousands of Rwandans using Byaboneka+ to reunite with their belongings</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard"><Button size="lg" variant="accent">Go to Dashboard</Button></Link>
                <Link to="/report-lost"><Button size="lg" variant="secondary" className="bg-white/10 border-white/30 text-white hover:bg-white/20">Report Lost Item</Button></Link>
              </>
            ) : (
              <>
                <Link to="/register"><Button size="lg" variant="accent">Create Free Account</Button></Link>
                <Link to="/login"><Button size="lg" variant="secondary" className="bg-white/10 border-white/30 text-white hover:bg-white/20">Sign In</Button></Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;