import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle, XCircle, MessageSquare,
  ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, Modal, Alert } from '../components/ui';
import api from '../services/api';
import { formatDate, formatDateShort, formatDateTime } from '../utils/dateUtils';
import toast from 'react-hot-toast';

interface ScamReport {
  id: number;
  reporter_id: number;
  reporter_name: string;
  reporter_email: string;
  reported_user_id: number;
  reported_name: string;
  reported_email: string;
  message_id: number | null;
  message_content: string | null;
  claim_id: number | null;
  reason: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

const AdminScamReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ScamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedReport, setSelectedReport] = useState<ScamReport | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState({ notes: '', action: 'dismiss' });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadReports();
  }, [page, statusFilter]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;

      const response = await api.get('/admin/scam-reports', { params });
      setReports(response.data.data || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to load scam reports');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedReport || !resolution.notes.trim()) return;
    setProcessing(true);
    try {
      await api.post(`/admin/scam-reports/${selectedReport.id}/resolve`, {
        resolution_notes: resolution.notes,
        action: resolution.action
      });
      toast.success('Report resolved successfully');
      setShowResolveModal(false);
      setSelectedReport(null);
      setResolution({ notes: '', action: 'dismiss' });
      loadReports();
    } catch (error) {
      toast.error('Failed to resolve report');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <Badge variant="danger">Open</Badge>;
      case 'INVESTIGATING': return <Badge variant="pending">Investigating</Badge>;
      case 'RESOLVED': return <Badge variant="verified">Resolved</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Scam Reports</h1>
        <p className="text-gray-600">Review and resolve user scam reports</p>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </Card>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckCircle className="w-16 h-16 text-trust-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Reports</h3>
          <p className="text-gray-500">No scam reports match your filters</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Report #{report.id}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(report.created_at)}
                    </p>
                  </div>
                </div>
                {getStatusBadge(report.status)}
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Reporter</p>
                  <p className="font-medium">{report.reporter_name}</p>
                  <p className="text-sm text-gray-500">{report.reporter_email}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Reported User</p>
                  <p className="font-medium">{report.reported_name}</p>
                  <p className="text-sm text-gray-500">{report.reported_email}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Reason</p>
                <p className="text-gray-900">{report.reason}</p>
              </div>

              {report.message_content && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-yellow-600" />
                    <p className="text-xs text-yellow-700 font-medium">Reported Message</p>
                  </div>
                  <p className="text-sm text-gray-900">"{report.message_content}"</p>
                </div>
              )}

              {report.resolution_notes && (
                <div className="mb-4 p-3 bg-trust-50 border border-trust-200 rounded-lg">
                  <p className="text-xs text-trust-700 font-medium mb-1">Resolution</p>
                  <p className="text-sm text-gray-900">{report.resolution_notes}</p>
                  {report.resolved_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Resolved on {formatDate(report.resolved_at)}
                    </p>
                  )}
                </div>
              )}

              {report.status === 'OPEN' && (
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setSelectedReport(report); setShowResolveModal(true); }}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Review & Resolve
                  </Button>
                </div>
              )}
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
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
        </div>
      )}

      {/* Resolve Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => { setShowResolveModal(false); setSelectedReport(null); }}
        title="Resolve Scam Report"
      >
        {selectedReport && (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Action to take
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="action"
                    value="dismiss"
                    checked={resolution.action === 'dismiss'}
                    onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                  />
                  <div>
                    <p className="font-medium">Dismiss Report</p>
                    <p className="text-sm text-gray-500">Report is false or unsubstantiated</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="action"
                    value="warn"
                    checked={resolution.action === 'warn'}
                    onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                  />
                  <div>
                    <p className="font-medium">Warn User</p>
                    <p className="text-sm text-gray-500">Issue warning and reduce trust score</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border border-red-200 rounded-lg cursor-pointer hover:bg-red-50">
                  <input
                    type="radio"
                    name="action"
                    value="ban"
                    checked={resolution.action === 'ban'}
                    onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                  />
                  <div>
                    <p className="font-medium text-red-600">Ban User</p>
                    <p className="text-sm text-gray-500">Permanently ban the reported user</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution notes *
              </label>
              <textarea
                value={resolution.notes}
                onChange={(e) => setResolution({ ...resolution, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Describe your findings and reasoning..."
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { setShowResolveModal(false); setSelectedReport(null); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                loading={processing}
                disabled={!resolution.notes.trim()}
                className="flex-1"
              >
                Resolve Report
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminScamReportsPage;
