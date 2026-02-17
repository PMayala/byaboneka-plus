import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, Calendar, User, ArrowLeft, Edit, Trash2,
  Sparkles, ExternalLink, Shield, Clock, CheckCircle
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, Alert, Modal } from '../components/ui';
import { lostItemsApi, claimsApi } from '../services/api';
import { LostItem, Match, CATEGORY_INFO, STATUS_INFO } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatDateShort, formatDateLong, formatDateTime } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const LostItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [item, setItem] = useState<LostItem | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = user?.id === item?.user_id;

  useEffect(() => {
    loadItem();
  }, [id]);

  useEffect(() => {
    if (item && isOwner) {
      loadMatches();
    }
  }, [item, isOwner]);

  const loadItem = async () => {
    try {
      const response = await lostItemsApi.getById(parseInt(id!));
      setItem(response.data.data);
    } catch (error) {
      toast.error('Failed to load item');
      navigate('/search?type=lost');
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    setMatchesLoading(true);
    try {
      const response = await lostItemsApi.getMatches(parseInt(id!));
      setMatches(response.data.data || []);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleClaim = async (foundItemId: number) => {
    if (!isAuthenticated) {
      toast.error('Please login to claim items');
      navigate('/login');
      return;
    }

    setClaimLoading(foundItemId);
    try {
      const response = await claimsApi.create({
        lost_item_id: parseInt(id!),
        found_item_id: foundItemId,
      });
      
      toast.success('Claim created! Please complete verification.');
      navigate(`/claims/${response.data.data.id}`);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create claim';
      toast.error(message);
    } finally {
      setClaimLoading(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await lostItemsApi.delete(parseInt(id!));
      toast.success('Item deleted successfully');
      navigate('/my-items');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete item');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Item Not Found</h1>
        <Link to="/search">
          <Button>Back to Search</Button>
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[item.status];
  const categoryInfo = CATEGORY_INFO[item.category];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back Link */}
      <Link 
        to="/search?type=lost" 
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Search
      </Link>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="md:col-span-2">
          <Card className="p-6 mb-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge variant={statusInfo?.color === 'blue' ? 'active' : statusInfo?.color === 'green' ? 'verified' : 'expired'}>
                  {statusInfo?.label || item.status}
                </Badge>
                <span className="ml-2 text-sm text-gray-500">{categoryInfo?.label}</span>
              </div>
              
              {isOwner && item.status === 'ACTIVE' && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/lost-items/${id}/edit`)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(true)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h1>

            {/* Details */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {item.location_area}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Lost on {formatDateLong(item.lost_date)}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {item.user_name || 'Anonymous'}
              </span>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{item.description}</p>
            </div>

            {item.location_hint && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Location Details</h3>
                <p className="text-gray-600">{item.location_hint}</p>
              </div>
            )}

            {/* Verification Questions (Owner Only) */}
            {isOwner && item.verification_questions && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-trust-500" />
                  Your Verification Questions
                </h3>
                <ul className="space-y-2">
                  {item.verification_questions.map((q, i) => (
                    <li key={i} className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      <strong>Q{i + 1}:</strong> {q}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Only you can see these questions. Claimants must answer correctly to prove ownership.
                </p>
              </div>
            )}
          </Card>

          {/* Matches Section (Owner Only) */}
          {isOwner && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent-500" />
                  Potential Matches
                </h2>
                <Button variant="ghost" size="sm" onClick={loadMatches} disabled={matchesLoading}>
                  Refresh
                </Button>
              </div>

              {matchesLoading ? (
                <LoadingSpinner />
              ) : matches.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-2">No matches found yet</p>
                  <p className="text-sm text-gray-400">
                    We'll notify you when someone reports a similar found item
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.map((match) => (
                    <div 
                      key={match.found_item?.id}
                      className="border border-gray-200 rounded-xl p-4 hover:border-primary-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-gray-900">
                              {match.found_item?.title}
                            </h3>
                            <Badge variant="verified">
                              Score: {match.score}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {match.found_item?.description}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {match.found_item?.location_area}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDateShort(match.found_item?.found_date || '')}
                            </span>
                          </div>

                          {/* Match Explanation */}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {match.explanation.slice(0, 4).map((exp, i) => (
                              <span 
                                key={i}
                                className="text-xs px-2 py-0.5 bg-trust-50 text-trust-700 rounded"
                              >
                                {exp}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Link to={`/found-items/${match.found_item?.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button 
                            size="sm"
                            onClick={() => handleClaim(match.found_item!.id)}
                            loading={claimLoading === match.found_item?.id}
                          >
                            Claim
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Status Card */}
          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Status</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.status === 'ACTIVE' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                <span className={item.status === 'ACTIVE' ? 'font-medium' : 'text-gray-500'}>Active</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.status === 'CLAIMED' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                <span className={item.status === 'CLAIMED' ? 'font-medium' : 'text-gray-500'}>Claimed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.status === 'RETURNED' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={item.status === 'RETURNED' ? 'font-medium' : 'text-gray-500'}>Returned</span>
              </div>
            </div>

            {item.status === 'RETURNED' && (
              <Alert type="success" className="mt-4">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                This item has been recovered!
              </Alert>
            )}
          </Card>

          {/* Posted Date */}
          <Card className="p-6">
            <p className="text-sm text-gray-500">
              <Clock className="w-4 h-4 inline mr-1" />
              Posted {formatDateLong(item.created_at)}
            </p>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Lost Item"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this lost item report? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default LostItemDetailPage;