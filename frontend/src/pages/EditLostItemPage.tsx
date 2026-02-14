import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, MapPin, Calendar,
  Smartphone, CreditCard, Wallet, Briefcase, Key, Package
} from 'lucide-react';
import { Button, Card, Input, Textarea, LoadingSpinner, Alert } from '../components/ui';
import { lostItemsApi } from '../services/api';
import { LostItem, ItemCategory, CATEGORY_INFO, RWANDA_LOCATIONS } from '../types';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const CATEGORY_ICONS: Record<ItemCategory, React.ReactNode> = {
  [ItemCategory.PHONE]: <Smartphone className="w-6 h-6" />,
  [ItemCategory.ID]: <CreditCard className="w-6 h-6" />,
  [ItemCategory.WALLET]: <Wallet className="w-6 h-6" />,
  [ItemCategory.BAG]: <Briefcase className="w-6 h-6" />,
  [ItemCategory.KEYS]: <Key className="w-6 h-6" />,
  [ItemCategory.OTHER]: <Package className="w-6 h-6" />,
};

const EditLostItemPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [item, setItem] = useState<LostItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_area: '',
    location_hint: '',
  });

  useEffect(() => {
    loadItem();
  }, [id]);

  const loadItem = async () => {
    try {
      const response = await lostItemsApi.getById(parseInt(id!));
      const data = response.data.data;

      // Only allow owner to edit
      if (data.user_id !== user?.id) {
        toast.error('You can only edit your own items');
        navigate(`/lost-items/${id}`);
        return;
      }

      setItem(data);
      setFormData({
        title: data.title || '',
        description: data.description || '',
        location_area: data.location_area || '',
        location_hint: data.location_hint || '',
      });
    } catch (error) {
      toast.error('Failed to load item');
      navigate('/my-items');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title || formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    if (!formData.description || formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }
    if (!formData.location_area) {
      newErrors.location_area = 'Please select a location';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await lostItemsApi.update(parseInt(id!), {
        title: formData.title,
        description: formData.description,
        location_area: formData.location_area,
        location_hint: formData.location_hint || undefined,
      });
      toast.success('Item updated successfully');
      navigate(`/lost-items/${id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update item');
    } finally {
      setSaving(false);
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
        <Button onClick={() => navigate('/my-items')}>Back to My Items</Button>
      </div>
    );
  }

  const categoryInfo = CATEGORY_INFO[item.category as ItemCategory];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back Link */}
      <button
        onClick={() => navigate(`/lost-items/${id}`)}
        className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Item
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Lost Item</h1>
        <p className="text-gray-600">Update the details of your lost item report</p>
      </div>

      {item.status !== 'ACTIVE' && (
        <Alert type="warning" className="mb-6">
          This item is currently <strong>{item.status.toLowerCase()}</strong>. Some fields may not be editable.
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 mb-6">
          {/* Category (read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-500">
                {CATEGORY_ICONS[item.category as ItemCategory]}
              </span>
              <span className="font-medium text-gray-700">{categoryInfo?.label || item.category}</span>
              <span className="text-xs text-gray-400 ml-auto">Cannot be changed</span>
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <Input
              label="Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Black iPhone 13 Pro with blue case"
              error={errors.title}
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <Textarea
              label="Description *"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your item in detail..."
              rows={4}
              error={errors.description}
            />
          </div>

          {/* Location */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location Area *
            </label>
            <select
              value={formData.location_area}
              onChange={(e) => setFormData({ ...formData, location_area: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                errors.location_area ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select location</option>
              {RWANDA_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            {errors.location_area && (
              <p className="mt-1 text-sm text-red-500">{errors.location_area}</p>
            )}
          </div>

          {/* Location Hint */}
          <div className="mb-6">
            <Textarea
              label="Location Details (Optional)"
              value={formData.location_hint}
              onChange={(e) => setFormData({ ...formData, location_hint: e.target.value })}
              placeholder="e.g., Near the main bus station, inside a moto taxi..."
              rows={2}
            />
          </div>

          {/* Date (read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date Lost
            </label>
            <input
              type="date"
              value={item.lost_date?.split('T')[0] || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">Date cannot be changed after submission</p>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button type="button" variant="secondary" onClick={() => navigate(`/lost-items/${id}`)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditLostItemPage;