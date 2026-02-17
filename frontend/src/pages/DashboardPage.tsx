import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Package, MessageSquare, Shield, 
  ArrowRight, CheckCircle, Clock, AlertCircle, TrendingUp
} from 'lucide-react';
import { Card, Badge, LoadingSpinner, EmptyState, Button } from '../components/ui';
import { useAuthStore } from '../store/authStore';
import { lostItemsApi, foundItemsApi, claimsApi, messagesApi } from '../services/api';
import { LostItem, FoundItem, Claim, CATEGORY_INFO, STATUS_INFO, ItemCategory } from '../types';
import { formatDate, formatDateShort } from '../utils/dateUtils';

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    lostItems: 0,
    foundItems: 0,
    activeClaims: 0,
    unreadMessages: 0
  });
  const [recentLostItems, setRecentLostItems] = useState<LostItem[]>([]);
  const [recentFoundItems, setRecentFoundItems] = useState<FoundItem[]>([]);
  const [recentClaims, setRecentClaims] = useState<Claim[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [lostRes, foundRes, claimsRes, unreadRes] = await Promise.all([
        lostItemsApi.getMine({ limit: 3 }).catch(() => ({ data: { data: [], pagination: { total: 0 } } })),
        foundItemsApi.getMine({ limit: 3 }).catch(() => ({ data: { data: [], pagination: { total: 0 } } })),
        claimsApi.getMine({ limit: 5 }).catch(() => ({ data: { data: [] } })),
        messagesApi.getUnreadCount().catch(() => ({ data: { data: { count: 0 } } }))
      ]);

      setRecentLostItems(lostRes.data.data || []);
      setRecentFoundItems(foundRes.data.data || []);
      setRecentClaims(claimsRes.data.data || []);

      // Handle both API response formats
      const unreadData = unreadRes.data.data as any;
      const unreadCount = unreadData?.count ?? unreadData?.unread_count ?? 0;

      setStats({
        lostItems: lostRes.data.pagination?.total || 0,
        foundItems: foundRes.data.pagination?.total || 0,
        activeClaims: (claimsRes.data.data || []).filter((c: Claim) => ['PENDING', 'VERIFIED'].includes(c.status)).length,
        unreadMessages: unreadCount
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const info = STATUS_INFO[status] || { label: status, color: 'gray' };
    const variantMap: Record<string, 'active' | 'verified' | 'pending' | 'expired' | 'danger'> = {
      blue: 'active',
      green: 'verified',
      yellow: 'pending',
      gray: 'expired',
      red: 'danger'
    };
    return <Badge variant={variantMap[info.color] || 'default'}>{info.label}</Badge>;
  };

  const getTrustLevel = (score: number) => {
    if (score >= 10) return { level: 'High', color: 'text-trust-600', bg: 'bg-trust-50' };
    if (score >= 5) return { level: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 0) return { level: 'New', color: 'text-gray-600', bg: 'bg-gray-50' };
    return { level: 'Low', color: 'text-red-600', bg: 'bg-red-50' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const trustInfo = getTrustLevel(user?.trust_score || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      {/* Welcome Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-600">Here's what's happening with your items</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-accent-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.lostItems}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Lost Reports</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-trust-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-trust-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.foundItems}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Found Items</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.activeClaims}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Active Claims</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.unreadMessages}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Unread Messages</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Trust Score Card */}
      <Card className={`p-4 sm:p-6 mb-6 sm:mb-8 ${trustInfo.bg} border-0`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <Shield className={`w-7 h-7 sm:w-8 sm:h-8 ${trustInfo.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {user?.trust_score || 0}
                </h2>
                <Badge variant={trustInfo.level === 'High' ? 'verified' : trustInfo.level === 'Medium' ? 'active' : 'default'}>
                  {trustInfo.level} Trust
                </Badge>
              </div>
              <p className="text-gray-600 text-sm sm:text-base">Your trust score</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-gray-600 mb-2">Build trust by:</p>
            <ul className="text-sm space-y-1">
              <li className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-trust-500" /> Returning found items
              </li>
              <li className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-trust-500" /> Successful recoveries
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6 sm:mb-8">
        <Link to="/report-lost">
          <Card hover className="p-4 sm:p-6 flex items-center justify-between h-full">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-accent-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Report Lost Item</h3>
                <p className="text-sm text-gray-500 hidden sm:block">Lost something? Report it now</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Card>
        </Link>

        <Link to="/report-found">
          <Card hover className="p-4 sm:p-6 flex items-center justify-between h-full">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-trust-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-trust-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Report Found Item</h3>
                <p className="text-sm text-gray-500 hidden sm:block">Found something? Help return it</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Recent Lost Items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Lost Items</h2>
            <Link to="/my-items?tab=lost" className="text-sm text-primary-500 hover:text-primary-600">
              View all
            </Link>
          </div>
          {recentLostItems.length > 0 ? (
            <div className="space-y-3">
              {recentLostItems.map((item) => (
                <Link key={item.id} to={`/lost-items/${item.id}`}>
                  <Card hover className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl flex-shrink-0">
                          {CATEGORY_INFO[item.category as ItemCategory]?.icon || '📦'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {item.location_area} • {formatDateShort(item.lost_date)}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <EmptyState
                icon={<FileText className="w-12 h-12" />}
                title="No lost items"
                description="Report a lost item to get started"
                action={
                  <Link to="/report-lost">
                    <Button size="sm">Report Lost Item</Button>
                  </Link>
                }
              />
            </Card>
          )}
        </div>

        {/* Recent Claims */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Claims</h2>
            <Link to="/my-items?tab=claims" className="text-sm text-primary-500 hover:text-primary-600">
              View all
            </Link>
          </div>
          {recentClaims.length > 0 ? (
            <div className="space-y-3">
              {recentClaims.map((claim) => (
                <Link key={claim.id} to={`/claims/${claim.id}`}>
                  <Card hover className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl flex-shrink-0">
                          {CATEGORY_INFO[claim.category as ItemCategory]?.icon || '📦'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {claim.lost_item_title || claim.found_item_title || `Claim #${claim.id}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDateShort(claim.created_at)}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(claim.status)}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <EmptyState
                icon={<CheckCircle className="w-12 h-12" />}
                title="No claims"
                description="Find a matching item to make a claim"
                action={
                  <Link to="/search">
                    <Button size="sm">Search Items</Button>
                  </Link>
                }
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;