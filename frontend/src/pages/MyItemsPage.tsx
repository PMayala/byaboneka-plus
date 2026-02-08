import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  FileText, Package, CheckCircle, Clock, Plus, Edit2, Trash2, 
  Eye, MapPin, Calendar, AlertCircle, RefreshCw
} from 'lucide-react';
import { Card, Badge, Button, LoadingSpinner, EmptyState, Tabs, ConfirmModal, Alert } from '../components/ui';
import { lostItemsApi, foundItemsApi, claimsApi } from '../services/api';
import { LostItem, FoundItem, Claim, CATEGORY_INFO, STATUS_INFO, ItemCategory } from '../types';
import { formatDate, formatDateShort } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const MyItemsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'lost');
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'lost' | 'found'; id: number | null }>({
    isOpen: false, type: 'lost', id: null
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lostRes, foundRes, claimsRes] = await Promise.all([
        lostItemsApi.getMine().catch(() => ({ data: { data: [] } })),
        foundItemsApi.getMine().catch(() => ({ data: { data: [] } })),
        claimsApi.getMine().catch(() => ({ data: { data: [] } })),
      ]);
      setLostItems(lostRes.data.data || []);
      setFoundItems(foundRes.data.data || []);
      setClaims(claimsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load items:', error);
      toast.error('Failed to load your items');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleDelete = async () => {
    if (!deleteModal.id) return;
    setDeleting(true);
    try {
      if (deleteModal.type === 'lost') {
        await lostItemsApi.delete(deleteModal.id);
        setLostItems(prev => prev.filter(item => item.id !== deleteModal.id));
        toast.success('Lost item deleted successfully');
      } else {
        await foundItemsApi.delete(deleteModal.id);
        setFoundItems(prev => prev.filter(item => item.id !== deleteModal.id));
        toast.success('Found item deleted successfully');
      }
      setDeleteModal({ isOpen: false, type: 'lost', id: null });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const info = STATUS_INFO[status] || { label: status, color: 'gray' };
    const variantMap: Record<string, 'active' | 'verified' | 'pending' | 'expired' | 'danger'> = {
      blue: 'active', green: 'verified', yellow: 'pending', gray: 'expired', red: 'danger'
    };
    return <Badge variant={variantMap[info.color] || 'default'} dot>{info.label}</Badge>;
  };

  const tabs = [
    { id: 'lost', label: 'Lost Items', icon: <FileText className="w-4 h-4" />, count: lostItems.length },
    { id: 'found', label: 'Found Items', icon: <Package className="w-4 h-4" />, count: foundItems.length },
    { id: 'claims', label: 'My Claims', icon: <CheckCircle className="w-4 h-4" />, count: claims.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">My Items</h1>
          <p className="text-gray-600">Manage your lost and found reports</p>
        </div>
        <div className="flex gap-2">
          <Link to="/report-lost">
            <Button variant="outline" size="sm" leftIcon={<Plus className="w-4 h-4" />}>Report Lost</Button>
          </Link>
          <Link to="/report-found">
            <Button size="sm" leftIcon={<Plus className="w-4 h-4" />}>Report Found</Button>
          </Link>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} className="mb-6" />

      {/* Lost Items Tab */}
      {activeTab === 'lost' && (
        <div>
          {lostItems.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={<FileText className="w-16 h-16" />}
                title="No lost items"
                description="Haven't lost anything? Great! If you do, report it here."
                action={<Link to="/report-lost"><Button>Report Lost Item</Button></Link>}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {lostItems.map((item) => (
                <Card key={item.id} className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl sm:text-3xl">{CATEGORY_INFO[item.category as ItemCategory]?.icon || '📦'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{item.title}</h3>
                          {getStatusBadge(item.status)}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{item.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {item.location_area}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDateShort(item.lost_date)}</span>
                          {item.match_count !== undefined && item.match_count > 0 && (
                            <Badge variant="info">{item.match_count} potential matches</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-2 sm:items-end">
                      <Link to={`/lost-items/${item.id}`} className="flex-1 sm:flex-none">
                        <Button variant="secondary" size="sm" fullWidth leftIcon={<Eye className="w-4 h-4" />}>View</Button>
                      </Link>
                      <Link to={`/lost-items/${item.id}/edit`} className="flex-1 sm:flex-none">
                        <Button variant="ghost" size="sm" fullWidth leftIcon={<Edit2 className="w-4 h-4" />}>Edit</Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        onClick={() => setDeleteModal({ isOpen: true, type: 'lost', id: item.id })}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Found Items Tab */}
      {activeTab === 'found' && (
        <div>
          {foundItems.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={<Package className="w-16 h-16" />}
                title="No found items"
                description="Found something? Help return it to its owner!"
                action={<Link to="/report-found"><Button>Report Found Item</Button></Link>}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {foundItems.map((item) => (
                <Card key={item.id} className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.image_urls && item.image_urls.length > 0 ? (
                          <img src={item.image_urls[0]} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl sm:text-3xl">{CATEGORY_INFO[item.category as ItemCategory]?.icon || '📦'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{item.title}</h3>
                          {getStatusBadge(item.status)}
                          {item.source === 'COOPERATIVE' && <Badge variant="info">Cooperative</Badge>}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{item.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {item.location_area}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {formatDateShort(item.found_date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-2 sm:items-end">
                      <Link to={`/found-items/${item.id}`} className="flex-1 sm:flex-none">
                        <Button variant="secondary" size="sm" fullWidth leftIcon={<Eye className="w-4 h-4" />}>View</Button>
                      </Link>
                      <Link to={`/found-items/${item.id}/edit`} className="flex-1 sm:flex-none">
                        <Button variant="ghost" size="sm" fullWidth leftIcon={<Edit2 className="w-4 h-4" />}>Edit</Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:bg-red-50 flex-1 sm:flex-none"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        onClick={() => setDeleteModal({ isOpen: true, type: 'found', id: item.id })}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <div>
          {claims.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={<CheckCircle className="w-16 h-16" />}
                title="No claims yet"
                description="When you find a potential match, create a claim to verify ownership"
                action={<Link to="/search"><Button>Search Items</Button></Link>}
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => (
                <Link key={claim.id} to={`/claims/${claim.id}`}>
                  <Card hover className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">{CATEGORY_INFO[claim.category as ItemCategory]?.icon || '📦'}</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{claim.lost_item_title || claim.found_item_title || `Claim #${claim.id}`}</h3>
                          <p className="text-sm text-gray-500">Created {formatDate(claim.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(claim.status)}
                        {claim.status === 'VERIFIED' && !claim.otp_verified && (
                          <Badge variant="pending">Awaiting Handover</Badge>
                        )}
                      </div>
                    </div>
                    {claim.status === 'PENDING' && (
                      <Alert type="info" className="mt-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>Verification needed - Answer the owner's questions to prove this is your item</span>
                        </div>
                      </Alert>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, type: 'lost', id: null })}
        onConfirm={handleDelete}
        title="Delete Item?"
        message={`Are you sure you want to delete this ${deleteModal.type} item? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
};

export default MyItemsPage;
