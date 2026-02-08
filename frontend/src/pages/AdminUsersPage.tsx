import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Ban, CheckCircle, Shield, 
  ChevronLeft, ChevronRight, MoreVertical, RefreshCw
} from 'lucide-react';
import { Button, Card, Badge, Input, LoadingSpinner, Modal, Alert } from '../components/ui';
import api from '../services/api';
import { formatDate, formatDateShort, formatDateTime } from '../utils/dateUtils';
import toast from 'react-hot-toast';

interface User {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  trust_score: number;
  is_banned: boolean;
  ban_reason: string | null;
  cooperative_name: string | null;
  created_at: string;
}

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/admin/users', { params });
      setUsers(response.data.data || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleBan = async () => {
    if (!selectedUser || !banReason.trim()) return;
    setProcessing(true);
    try {
      await api.post(`/admin/users/${selectedUser.id}/ban`, { reason: banReason });
      toast.success('User banned successfully');
      setShowBanModal(false);
      setBanReason('');
      setSelectedUser(null);
      loadUsers();
    } catch (error) {
      toast.error('Failed to ban user');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnban = async (userId: number) => {
    try {
      await api.post(`/admin/users/${userId}/unban`);
      toast.success('User unbanned successfully');
      loadUsers();
    } catch (error) {
      toast.error('Failed to unban user');
    }
  };

  const handleRecalculateTrust = async (userId: number) => {
    try {
      const response = await api.post(`/admin/users/${userId}/recalculate-trust`);
      toast.success(`Trust score updated to ${response.data.data.new_trust_score}`);
      loadUsers();
    } catch (error) {
      toast.error('Failed to recalculate trust');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <Badge variant="verified">Admin</Badge>;
      case 'coop_staff': return <Badge variant="active">Coop Staff</Badge>;
      default: return <Badge variant="default">Citizen</Badge>;
    }
  };

  const getTrustBadge = (score: number) => {
    if (score >= 10) return <span className="text-trust-600 font-medium">+{score}</span>;
    if (score >= 0) return <span className="text-gray-600">{score}</span>;
    return <span className="text-red-600 font-medium">{score}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">View and manage platform users</p>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="pl-10"
              />
            </div>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Roles</option>
            <option value="citizen">Citizens</option>
            <option value="coop_staff">Coop Staff</option>
            <option value="admin">Admins</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">User</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Trust</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Joined</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.cooperative_name && (
                              <p className="text-xs text-primary-600">{user.cooperative_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                        <td className="px-4 py-3">{getTrustBadge(user.trust_score)}</td>
                        <td className="px-4 py-3">
                          {user.is_banned ? (
                            <Badge variant="danger">Banned</Badge>
                          ) : (
                            <Badge variant="verified">Active</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRecalculateTrust(user.id)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Recalculate Trust"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            {user.is_banned ? (
                              <button
                                onClick={() => handleUnban(user.id)}
                                className="p-1 text-trust-500 hover:text-trust-600"
                                title="Unban User"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            ) : user.role !== 'admin' ? (
                              <button
                                onClick={() => { setSelectedUser(user); setShowBanModal(true); }}
                                className="p-1 text-red-400 hover:text-red-600"
                                title="Ban User"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Ban Modal */}
      <Modal
        isOpen={showBanModal}
        onClose={() => { setShowBanModal(false); setSelectedUser(null); setBanReason(''); }}
        title="Ban User"
      >
        {selectedUser && (
          <div>
            <Alert type="warning" className="mb-4">
              You are about to ban <strong>{selectedUser.name}</strong> ({selectedUser.email}).
              This will prevent them from using the platform.
            </Alert>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for ban *
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Enter reason for banning this user..."
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { setShowBanModal(false); setSelectedUser(null); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBan}
                loading={processing}
                disabled={!banReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600"
              >
                Ban User
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
