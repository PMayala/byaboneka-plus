/**
 * FoundItemDetailPage — FIXED
 *
 * Changes vs original:
 *  1. Finder sees a prominent alert card when there are PENDING_QUESTIONS claims
 *     on this item, with a direct link to act on them.
 *  2. Authenticated non-finder users with at least one active lost report see a
 *     "Claim This Item" button with a modal to pick the matching lost report.
 *  3. Image gallery is preserved for display (read-only) but no upload UI.
 *  4. All existing functionality (matches, delete, coop badge) retained.
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  User,
  ArrowLeft,
  Edit,
  Trash2,
  Building,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Bell,
  FileText,
} from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  LoadingSpinner,
  Alert,
  Modal,
} from '../components/ui';
import { foundItemsApi, claimsApi, lostItemsApi } from '../services/api';
import { FoundItem, LostItem, CATEGORY_INFO, STATUS_INFO } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatDateLong } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface MatchResult {
  lost_item: LostItem;
  score: number;
  explanation: string[];
}

interface PendingClaim {
  id: number;
  status: string;
  claimant_name?: string;
  created_at: string;
}

const getMatchScoreBadgeVariant = (score: number): 'verified' | 'pending' | 'default' => {
  if (score >= 8) return 'verified';
  if (score >= 5) return 'pending';
  return 'default';
};

const FoundItemDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [item, setItem] = useState<FoundItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Matches (finder)
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Pending claims on this item (finder notification)
  const [pendingClaims, setPendingClaims] = useState<PendingClaim[]>([]);

  // Claim this item (owner/claimant flow)
  const [myLostItems, setMyLostItems] = useState<LostItem[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedLostItemId, setSelectedLostItemId] = useState<number | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);

  const isFinder = user?.id === item?.finder_id;
  const isLoggedIn = !!user;

  useEffect(() => {
    loadItem();
  }, [id]);

  useEffect(() => {
    if (!item) return;
    // Finder: load pending claims so they know action is needed
    if (isFinder) {
      loadPendingClaims();
    }
    // Logged-in non-finder: pre-load their lost items for the claim modal
    if (isLoggedIn && !isFinder && item.status === 'UNCLAIMED') {
      loadMyLostItems();
    }
  }, [item, isFinder]);

  const loadItem = async () => {
    try {
      const response = await foundItemsApi.getById(parseInt(id!));
      setItem(response.data.data);
    } catch (error) {
      toast.error(t('items.loadError'));
      navigate('/search?type=found');
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    if (!id) return;
    setMatchesLoading(true);
    try {
      const response = await foundItemsApi.getMatches(parseInt(id));
      setMatches(response.data.data || []);
    } catch (error) {
      console.error('Failed to load matches:', error);
    } finally {
      setMatchesLoading(false);
    }
  };

  /** Load claims on this found item that are awaiting the finder's action */
  const loadPendingClaims = async () => {
    try {
      // getMine returns claimant-side claims; for finder we use getFinderClaims
      const response = await claimsApi.getFinderClaims(parseInt(id!));
      const claims: PendingClaim[] = (response.data.data || []).filter(
        (c: PendingClaim) => c.status === 'PENDING_QUESTIONS'
      );
      setPendingClaims(claims);
    } catch (error) {
      // Non-fatal — some backends may not have this endpoint yet
      console.warn('Could not load pending claims for this item:', error);
    }
  };

  const loadMyLostItems = async () => {
    try {
      const response = await lostItemsApi.getMine({ limit: 50 });
      // Only show active lost items
      const active = (response.data.data || []).filter((li: LostItem) => li.status === 'ACTIVE');
      setMyLostItems(active);
    } catch (error) {
      console.warn('Could not load lost items:', error);
    }
  };

  const handleClaimSubmit = async () => {
    if (!selectedLostItemId) {
      toast.error('Please select which of your lost items this matches.');
      return;
    }
    setClaimLoading(true);
    try {
      const response = await claimsApi.create({
        lost_item_id: selectedLostItemId,
        found_item_id: parseInt(id!),
      });
      toast.success('Claim submitted! The finder will be asked to set verification questions.');
      navigate(`/claims/${response.data.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create claim');
    } finally {
      setClaimLoading(false);
      setShowClaimModal(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await foundItemsApi.delete(parseInt(id!));
      toast.success(t('items.deleteSuccess'));
      navigate('/my-items');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('items.deleteFailed'));
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const nextImage = () => {
    if (item?.image_urls) {
      setCurrentImageIndex((prev) => (prev + 1) % item.image_urls.length);
    }
  };
  const prevImage = () => {
    if (item?.image_urls) {
      setCurrentImageIndex(
        (prev) => (prev - 1 + item.image_urls.length) % item.image_urls.length
      );
    }
  };

  /* ─── Guards ─── */
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
          <Button>{t('items.backToSearch')}</Button>
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[item.status];
  const categoryInfo = CATEGORY_INFO[item.category];
  const apiBase =
    import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

  /* ─── Render ─── */
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        to="/search?type=found"
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Search
      </Link>

      {/* ══ FINDER: Pending claim alert ══ */}
      {isFinder && pendingClaims.length > 0 && (
        <Alert type="warning" className="mb-6">
          <Bell className="w-4 h-4 inline mr-2" />
          <strong>Action required:</strong> {pendingClaims.length} person
          {pendingClaims.length > 1 ? 's have' : ' has'} claimed this item and{' '}
          {pendingClaims.length > 1 ? 'are' : 'is'} waiting for you to set verification
          questions.{' '}
          {pendingClaims.map((c) => (
            <Link
              key={c.id}
              to={`/claims/${c.id}`}
              className="underline font-semibold ml-1"
            >
              Review Claim #{c.id} →
            </Link>
          ))}
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* ── Main content ── */}
        <div className="md:col-span-2">
          {/* Image gallery (display only) */}
          {item.image_urls && item.image_urls.length > 0 && (
            <Card className="mb-6 overflow-hidden">
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={`${apiBase}${item.image_urls[currentImageIndex]}`}
                  alt={item.title}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.png';
                  }}
                />
                {item.image_urls.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {item.image_urls.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Item detail card */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge
                  variant={
                    statusInfo?.color === 'blue'
                      ? 'active'
                      : statusInfo?.color === 'green'
                      ? 'verified'
                      : 'expired'
                  }
                >
                  {statusInfo?.label || item.status}
                </Badge>
                <span className="ml-2 text-sm text-gray-500">{categoryInfo?.label}</span>
              </div>

              {isFinder && item.status === 'UNCLAIMED' && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/found-items/${id}/edit`)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h1>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {item.location_area}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Found on {formatDateLong(item.found_date)}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {item.finder_name || 'Anonymous'}
              </span>
            </div>

            {item.source === 'COOPERATIVE' && item.cooperative_name && (
              <Alert type="info" className="mb-6">
                <Building className="w-4 h-4 inline mr-2" />
                This item is held at <strong>{item.cooperative_name}</strong>
              </Alert>
            )}

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{item.description}</p>
            </div>

            {item.location_hint && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">Where it was found</h3>
                <p className="text-gray-600">{item.location_hint}</p>
              </div>
            )}

            {(item.category === 'ID' || item.category === 'WALLET') && (
              <Alert type="warning" className="mt-6">
                <Shield className="w-4 h-4 inline mr-2" />
                <strong>{t('items.privacyNote')}</strong> This item may contain sensitive data.
                Full details are only shared with verified owners.
              </Alert>
            )}

            {/* Finder: potential matching lost items */}
            {isFinder && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Potential Matching Lost Items</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMatches}
                    disabled={matchesLoading}
                  >
                    {matchesLoading ? 'Searching…' : matches.length > 0 ? 'Refresh' : 'Find Matches'}
                  </Button>
                </div>
                {matchesLoading ? (
                  <LoadingSpinner size="sm" />
                ) : matches.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Click "Find Matches" to search for lost items that match this report.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {matches.map((match) => (
                      <Card
                        key={match.lost_item?.id || Math.random()}
                        className="p-4 border border-gray-200 hover:border-primary-300 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <Link
                              to={`/lost-items/${match.lost_item?.id}`}
                              className="font-medium text-gray-900 hover:text-primary-600"
                            >
                              {match.lost_item?.title || 'Untitled'}
                            </Link>
                            <p className="text-sm text-gray-500 mt-1">
                              {match.lost_item?.description?.slice(0, 100)}…
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {match.explanation?.map((reason, i) => (
                                <Badge key={i} variant="info" className="text-xs">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Badge variant={getMatchScoreBadgeVariant(match.score)}>
                            {match.score}/13
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div>
          {/* ── Owner: Claim This Item ── */}
          {!isFinder && item.status === 'UNCLAIMED' && (
            <Card className="p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Is this yours?</h3>
              {isLoggedIn ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    If this looks like your lost item, create a claim. The finder will set
                    verification questions you'll need to answer to prove ownership.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (myLostItems.length === 0) {
                        navigate('/report-lost');
                      } else {
                        setShowClaimModal(true);
                      }
                    }}
                  >
                    {myLostItems.length === 0 ? 'Report Lost Item First' : 'Claim This Item'}
                  </Button>
                  {myLostItems.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      You need an active lost-item report before claiming.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Sign in to claim this item or report it as lost.
                  </p>
                  <Link to="/login">
                    <Button className="w-full">Sign In to Claim</Button>
                  </Link>
                </>
              )}
            </Card>
          )}

          {/* ── Already claimed / matched / returned ── */}
          {!isFinder && item.status !== 'UNCLAIMED' && (
            <Card className="p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Status</h3>
              <p className="text-sm text-gray-600">
                This item is currently <strong>{statusInfo?.label || item.status}</strong> and is
                not available to claim.
              </p>
            </Card>
          )}

          {/* ── Finder: "What happens next" ── */}
          {isFinder && (
            <Card className="p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
              <ol className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                    1
                  </span>
                  Someone who lost this type of item will submit a claim.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                    2
                  </span>
                  You'll be notified here (and by email) to set 3 verification questions.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                    3
                  </span>
                  If they answer correctly, you arrange a safe handover using an OTP code.
                </li>
              </ol>
              <Link to="/my-items?tab=found" className="block mt-4 text-sm text-primary-500 hover:underline">
                View my found items →
              </Link>
            </Card>
          )}

          {/* Status tracker */}
          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Status</h3>
            <div className="space-y-3">
              {(['UNCLAIMED', 'MATCHED', 'RETURNED'] as const).map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      item.status === s ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  />
                  <span
                    className={
                      item.status === s ? 'font-medium text-gray-900' : 'text-gray-400 text-sm'
                    }
                  >
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Posted date */}
          <Card className="p-6">
            <p className="text-sm text-gray-500">
              <Clock className="w-4 h-4 inline mr-1" />
              Posted {formatDateLong(item.created_at)}
            </p>
          </Card>
        </div>
      </div>

      {/* ── Claim modal: pick lost item ── */}
      <Modal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        title="Which lost item is this?"
      >
        <p className="text-sm text-gray-600 mb-4">
          Select the lost-item report that matches this found item.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
          {myLostItems.map((li) => (
            <button
              key={li.id}
              type="button"
              onClick={() => setSelectedLostItemId(li.id)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                selectedLostItemId === li.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-900">{li.title}</p>
                  <p className="text-xs text-gray-500">
                    {li.location_area} · {formatDate(li.lost_date)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowClaimModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleClaimSubmit}
            loading={claimLoading}
            disabled={!selectedLostItemId}
          >
            Submit Claim
          </Button>
        </div>
      </Modal>

      {/* ── Delete modal ── */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Found Item"
      >
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete this found item report? This action cannot be undone.
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

export default FoundItemDetailPage;