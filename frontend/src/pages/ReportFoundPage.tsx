import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, Upload, X, MapPin, Calendar, Check,
  Smartphone, CreditCard, Wallet, Briefcase, Key, Package,
  Building, AlertCircle
} from 'lucide-react';
import { Button, Card, Input, Textarea, Alert } from '../components/ui';
import { foundItemsApi } from '../services/api';
import { ItemCategory, CATEGORY_INFO, RWANDA_LOCATIONS } from '../types';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const CATEGORY_ICONS: Record<ItemCategory, React.ReactNode> = {
  [ItemCategory.PHONE]: <Smartphone className="w-8 h-8" />,
  [ItemCategory.ID]: <CreditCard className="w-8 h-8" />,
  [ItemCategory.WALLET]: <Wallet className="w-8 h-8" />,
  [ItemCategory.BAG]: <Briefcase className="w-8 h-8" />,
  [ItemCategory.KEYS]: <Key className="w-8 h-8" />,
  [ItemCategory.OTHER]: <Package className="w-8 h-8" />,
};

interface FormData {
  category: ItemCategory | '';
  title: string;
  description: string;
  location_area: string;
  location_hint: string;
  found_date: string;
}

const ReportFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagesPreviews, setImagesPreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormData>({
    category: '',
    title: '',
    description: '',
    location_area: '',
    location_hint: '',
    found_date: new Date().toISOString().split('T')[0],
  });

  const isCoopStaff = user?.role === 'coop_staff';

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).slice(0, 5 - images.length);
    
    // Validate file types and sizes
    for (const file of newFiles) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Only JPEG, PNG, and WebP images are allowed');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
    }

    // Create previews
    const previews = newFiles.map((file) => URL.createObjectURL(file));
    
    setImages([...images, ...newFiles]);
    setImagesPreviews([...imagesPreviews, ...previews]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagesPreviews[index]);
    setImages(images.filter((_, i) => i !== index));
    setImagesPreviews(imagesPreviews.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.category) newErrors.category = 'Please select a category';
    if (!formData.title || formData.title.length < 3) newErrors.title = 'Title must be at least 3 characters';
    if (!formData.description || formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }
    if (!formData.location_area) newErrors.location_area = 'Please select a location';
    if (!formData.found_date) newErrors.found_date = 'Please enter the date you found the item';
    if (images.length === 0) newErrors.images = 'Please upload at least one image';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Create the found item first
      const createData = {
        category: formData.category,
        title: formData.title,
        description: formData.description,
        location_area: formData.location_area,
        location_hint: formData.location_hint || undefined,
        found_date: formData.found_date,
        cooperative_id: isCoopStaff && user?.cooperative_id ? user.cooperative_id : undefined,
      };

      const response = await foundItemsApi.create(createData);
      const itemId = response.data.data.id;

      // Upload images
      if (images.length > 0) {
        setUploadingImages(true);
        const fileList = new DataTransfer();
        images.forEach((file) => fileList.items.add(file));
        await foundItemsApi.uploadImages(itemId, fileList.files);
      }

      toast.success('Found item reported successfully!');
      navigate(`/found-items/${itemId}`);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to submit report';
      toast.error(message);
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Found Item</h1>
        <p className="text-gray-600">
          Thank you for helping reunite someone with their belongings!
        </p>
      </div>

      {isCoopStaff && (
        <Alert type="info" className="mb-6">
          <Building className="w-4 h-4 inline mr-2" />
          You're reporting as a <strong>Cooperative Staff</strong>. This item will be associated 
          with your cooperative and held for secure pickup.
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Item Details</h2>

          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Category *</label>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: key as ItemCategory })}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formData.category === key
                      ? 'border-trust-500 bg-trust-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`mx-auto mb-2 ${formData.category === key ? 'text-trust-500' : 'text-gray-400'}`}>
                    {CATEGORY_ICONS[key as ItemCategory]}
                  </div>
                  <p className={`text-sm font-medium ${formData.category === key ? 'text-trust-500' : 'text-gray-600'}`}>
                    {info.label}
                  </p>
                </button>
              ))}
            </div>
            {errors.category && <p className="mt-2 text-sm text-red-500">{errors.category}</p>}
          </div>

          {/* Title */}
          <div className="mb-6">
            <Input
              label="Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Black phone found at bus station"
              error={errors.title}
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <Textarea
              label="Description *"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what you found. Include visible details but NOT sensitive information like ID numbers..."
              rows={4}
              error={errors.description}
            />
            {(formData.category === 'ID' || formData.category === 'WALLET') && (
              <p className="mt-2 text-sm text-yellow-600">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Do NOT include personal information like ID numbers, names, or card details
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Location & Date</h2>

          {/* Location */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Where did you find it? *
            </label>
            <select
              value={formData.location_area}
              onChange={(e) => setFormData({ ...formData, location_area: e.target.value })}
              className={`input ${errors.location_area ? 'border-red-500' : ''}`}
            >
              <option value="">Select location</option>
              {RWANDA_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            {errors.location_area && <p className="mt-1 text-sm text-red-500">{errors.location_area}</p>}
          </div>

          {/* Location Hint */}
          <div className="mb-6">
            <Textarea
              label="Specific Location (Optional)"
              value={formData.location_hint}
              onChange={(e) => setFormData({ ...formData, location_hint: e.target.value })}
              placeholder="e.g., Under seat 23 on bus KM-456-A, near the market entrance..."
              rows={2}
            />
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              When did you find it? *
            </label>
            <input
              type="date"
              value={formData.found_date}
              onChange={(e) => setFormData({ ...formData, found_date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className={`input ${errors.found_date ? 'border-red-500' : ''}`}
            />
            {errors.found_date && <p className="mt-1 text-sm text-red-500">{errors.found_date}</p>}
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            <Camera className="w-5 h-5 inline mr-2" />
            Photos *
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload clear photos of the item. This helps owners identify their belongings.
          </p>

          {/* Image Upload Area */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {imagesPreviews.map((preview, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {images.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 flex flex-col items-center justify-center transition-colors"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Add Photo</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />

          {errors.images && <p className="text-sm text-red-500">{errors.images}</p>}
          <p className="text-xs text-gray-500 mt-2">
            Max 5 images, 5MB each. JPEG, PNG, or WebP format.
          </p>
        </Card>

        {/* Important Notice */}
        <Alert type="warning" className="mb-6">
          <strong>Important:</strong> Never demand payment before verification. Byaboneka+ uses 
          secure verification to confirm ownership. Attempting to extort money is against our 
          policies and may result in account suspension.
        </Alert>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading || uploadingImages}>
            <Check className="w-4 h-4 mr-2" />
            {uploadingImages ? 'Uploading Images...' : 'Submit Report'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ReportFoundPage;
