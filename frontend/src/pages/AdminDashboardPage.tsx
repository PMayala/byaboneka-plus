import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, FileText, Package, Shield, AlertTriangle, 
  CheckCircle, TrendingUp, Activity, ChevronRight
} from 'lucide-react';
import { Card, LoadingSpinner, Badge } from '../components/ui';
import { adminApi, AdminStats } from '../services/api';
import { formatDate, formatDateShort, formatDateTime } from '../utils/dateUtils';

/**
 * AdminDashboardPage - FIXED VERSION
 * 
 * FIX #2: Uses proper AdminStats type that matches backend response
 * FIX #12: Removed links to non-existent /admin/audit-logs and /admin/cooperatives pages
 */

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // FIX: Use typed adminApi methods instead of raw api.get
      const [statsRes, usersRes, reportsRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getUsers({ limit: 5 }),
        adminApi.getScamReports({ status: 'OPEN', limit: 5 }),
      ]);
      setStats(statsRes.data.data);
      setRecentUsers(usersRes.data.data || []);
      setPendingReports(reportsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.total_users || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-100' },
    { label: 'Lost Items', value: stats?.total_lost_items || 0, icon: FileText, color: 'text-orange-500', bg: 'bg-orange-100' },
    { label: 'Found Items', value: stats?.total_found_items || 0, icon: Package, color: 'text-green-500', bg: 'bg-green-100' },
    { label: 'Total Claims', value: stats?.total_claims || 0, icon: Shield, color: 'text-purple-500', bg: 'bg-purple-100' },
    { label: 'Successful Returns', value: stats?.successful_returns || 0, icon: CheckCircle, color: 'text-trust-500', bg: 'bg-trust-100' },
    { label: 'Pending Reports', value: stats?.pending_scam_reports || 0, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Platform overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Users</h2>
            <Link to="/admin/users" className="text-sm text-primary-500 hover:text-primary-600 flex items-center">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No users yet</p>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={user.role === 'admin' ? 'verified' : user.role === 'coop_staff' ? 'active' : 'default'}>
                      {user.role}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateShort(user.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Pending Scam Reports */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Scam Reports</h2>
            <Link to="/admin/scam-reports" className="text-sm text-primary-500 hover:text-primary-600 flex items-center">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {pendingReports.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-trust-500 mx-auto mb-2" />
                <p className="text-gray-500">No pending reports</p>
              </div>
            ) : (
              pendingReports.map((report) => (
                <div key={report.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Report #{report.id}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{report.reason}</p>
                    </div>
                    <Badge variant="danger">Open</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    By {report.reporter_name} • {formatDateTime(report.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions - FIX #12: Only link to pages that actually exist */}
      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <Link to="/admin/users" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
            <Users className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-medium">Manage Users</p>
          </Link>
          <Link to="/admin/scam-reports" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center">
            <AlertTriangle className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-medium">Scam Reports</p>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;