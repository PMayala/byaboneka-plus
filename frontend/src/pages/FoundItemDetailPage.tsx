import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, Calendar, User, ArrowLeft, Edit, Trash2, Building,
  ChevronLeft, ChevronRight, Shield, Clock
} from 'lucide-react';
import { Button, Card, Badge, LoadingSpinner, Alert, Modal } from '../components/ui';
import { foundItemsApi } from '../services/api';
import { FoundItem, CATEGORY_INFO, STATUS_INFO } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatDateShort, formatDateLong, formatDateTime } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const FoundItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [item, setItem] = useState<FoundItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isFinder = user?.id === item?.finder_id;

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    try {
      const response = await foundItemsApi.getById(parseInt(id!));
      setItem(response.data.data);
    } catch (error) {
      toast.error('Failed to load item');
      navigate('/search?type=found');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await foundItemsApi.delete(parseInt(id!));
      toast.success('Item deleted successfully');
      navigate('/my-items');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete item');
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
      setCurrentImageIndex((prev) => (prev - 1 + item.image_urls.length) % item.image_urls.length);
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
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back Link */}
      <Link 
        to="/search?type=found" 
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Search
      </Link>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="md:col-span-2">
          {/* Image Gallery */}
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

              {/* Thumbnails */}
              {item.image_urls.length > 1 && (
                <div className="p-4 flex gap-2 overflow-x-auto">
                  {item.image_urls.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                        index === currentImageIndex ? 'border-primary-500' : 'border-transparent'
                      }`}
                    >
                      <img
                        src={`${apiBase}${url}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge variant={statusInfo?.color === 'blue' ? 'active' : statusInfo?.color === 'green' ? 'verified' : 'expired'}>
                  {statusInfo?.label || item.status}
                </Badge>
                <span className="ml-2 text-sm text-gray-500">{categoryInfo?.label}</span>
              </div>
              
              {isFinder && item.status === 'UNCLAIMED' && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/found-items/${id}/edit`)}>
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
                Found on {formatDateLong(item.found_date)}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {item.finder_name || 'Anonymous'}
              </span>
            </div>

            {/* Cooperative Badge */}
            {item.source === 'COOPERATIVE' && item.cooperative_name && (
              <Alert type="info" className="mb-6">
                <Building className="w-4 h-4 inline mr-2" />
                This item is held at <strong>{item.cooperative_name}</strong>
              </Alert>
            )}

            {/* Description */}
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

            {/* Privacy Notice for Sensitive Items */}
            {(item.category === 'ID' || item.category === 'WALLET') && (
              <Alert type="warning" className="mt-6">
                <Shield className="w-4 h-4 inline mr-2" />
                <strong>Privacy Protected:</strong> Full details and images are only shown to 
                verified owners. Claim this item and complete verification to access all information.
              </Alert>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div>
          {/* Claim Instructions */}
          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Is this yours?</h3>
            
            <p className="text-sm text-gray-600 mb-4">
              If this looks like your lost item, you'll need to:
            </p>

            <ol className="text-sm text-gray-600 space-y-2 mb-6">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">1</span>
                Report your lost item first
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">2</span>
                Create a claim linking to this found item
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">3</span>
                Answer verification questions
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">4</span>
                Coordinate pickup with OTP code
              </li>
            </ol>

            <Link to="/report-lost">
              <Button className="w-full">
                Report Lost Item
              </Button>
            </Link>
          </Card>

          {/* Status */}
          <Card className="p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Status</h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.status === 'UNCLAIMED' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                <span className={item.status === 'UNCLAIMED' ? 'font-medium' : 'text-gray-500'}>Unclaimed</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.status === 'MATCHED' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                <span className={item.status === 'MATCHED' ? 'font-medium' : 'text-gray-500'}>Matched</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.status === 'RETURNED' ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={item.status === 'RETURNED' ? 'font-medium' : 'text-gray-500'}>Returned</span>
              </div>
            </div>
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
