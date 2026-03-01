import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Smartphone,
  CreditCard,
  Wallet,
  Briefcase,
  Key,
  Package,
  MapPin,
  Calendar,
  Camera,
  Upload,
  X,
} from 'lucide-react';
import { Button, Card, Input, Textarea } from '../components/ui';
import { lostItemsApi, duplicateApi } from '../services/api';
import { DuplicateWarning } from '../components/DuplicateWarning';
import { ItemCategory, CATEGORY_INFO, RWANDA_LOCATIONS } from '../types';
import { useRecaptcha } from '../hooks/useRecaptcha';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  lost_date: string;
}

const ReportLostPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { executeRecaptcha } = useRecaptcha();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2-step wizard (Item Details -> Location & Date)
  const [step, setStep] = useState(1);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Image upload state
  const [images, setImages] = useState<File[]>([]);
  const [imagesPreviews, setImagesPreviews] = useState<string[]>([]);

  const [formData, setFormData] = useState<FormData>({
    category: '',
    title: '',
    description: '',
    location_area: '',
    location_hint: '',
    lost_date: new Date().toISOString().split('T')[0],
  });

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).slice(0, 5 - images.length);

    for (const file of newFiles) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 5MB.');
        return;
      }
    }

    const previews = newFiles.map((file) => URL.createObjectURL(file));
    setImages([...images, ...newFiles]);
    setImagesPreviews([...imagesPreviews, ...previews]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagesPreviews[index]);
    setImages(images.filter((_, i) => i !== index));
    setImagesPreviews(imagesPreviews.filter((_, i) => i !== index));
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.category) newErrors.category = 'Please select a category';
      if (!formData.title || formData.title.length < 3) {
        newErrors.title = 'Title must be at least 3 characters';
      }
      if (!formData.description || formData.description.length < 10) {
        newErrors.description = 'Description must be at least 10 characters';
      }
    }

    if (currentStep === 2) {
      if (!formData.location_area) newErrors.location_area = 'Please select a location';
      if (!formData.lost_date) newErrors.lost_date = 'Please enter the date you lost the item';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    // Final step is step 2 now
    if (!validateStep(2)) return;

    // Check for duplicates first
    if (!showDuplicateWarning && duplicateCandidates.length === 0) {
      try {
        const dupRes = await duplicateApi.checkLost({
          category: formData.category,
          title: formData.title,
          description: formData.description,
          location_area: formData.location_area,
          lost_date: formData.lost_date,
        });

        if (dupRes.data.data?.has_potential_duplicates && dupRes.data.data.candidates.length > 0) {
          setDuplicateCandidates(dupRes.data.data.candidates);
          setShowDuplicateWarning(true);
          return;
        }
      } catch (error) {
        console.warn('Duplicate check failed:', error);
      }
    }

    await submitLostItem();
  };

  const submitLostItem = async () => {
    setShowDuplicateWarning(false);
    setLoading(true);

    try {
      const recaptchaToken = await executeRecaptcha('report_lost');

      // Submit ONLY the required fields:
      // category, title, description, location_area, location_hint, lost_date
      const response = await lostItemsApi.create({
        category: formData.category,
        title: formData.title,
        description: formData.description,
        location_area: formData.location_area,
        location_hint: formData.location_hint,
        lost_date: formData.lost_date,
        ...(recaptchaToken && { recaptchaToken }),
      } as any);

      const itemId = response.data.data.id;

      // Upload images if any
      if (images.length > 0) {
        try {
          const fileList = new DataTransfer();
          images.forEach((file) => fileList.items.add(file));
          await lostItemsApi.uploadImages(itemId, fileList.files);
        } catch (imgError) {
          console.warn('Image upload failed, item was created:', imgError);
          toast.error('Item created but image upload failed. You can add images later.');
        }
      }

      toast.success(t('reportLost.reportSuccess'));
      navigate(`/lost-items/${itemId}`);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to submit report';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showDuplicateWarning && (
        <DuplicateWarning
          candidates={duplicateCandidates}
          itemType="lost"
          onContinue={() => submitLostItem()}
          onViewDuplicate={(id, type) =>
            navigate(`/${type === 'lost' ? 'lost-items' : 'found-items'}/${id}`)
          }
          onCancel={() => {
            setShowDuplicateWarning(false);
            setDuplicateCandidates([]);
          }}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('reportLost.title')}</h1>
          <p className="text-gray-600">Provide details about your lost item to help us match it with found items</p>
        </div>

        {/* Progress Steps (2 steps) */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                    s < step
                      ? 'bg-trust-500 text-white'
                      : s === step
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s < step ? <Check className="w-5 h-5" /> : s}
                </div>
                <span className={`ml-2 text-sm font-medium ${s === step ? 'text-primary-500' : 'text-gray-500'}`}>
                  {s === 1 ? 'Item Details' : 'Location & Date'}
                </span>
              </div>
              {s < 2 && <div className={`flex-1 h-1 mx-4 rounded ${s < step ? 'bg-trust-500' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Item Details */}
        {step === 1 && (
          <Card className="p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">What did you lose?</h2>

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
                      formData.category === key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`mx-auto mb-2 ${formData.category === key ? 'text-primary-500' : 'text-gray-400'}`}>
                      {CATEGORY_ICONS[key as ItemCategory]}
                    </div>
                    <p className={`text-sm font-medium ${formData.category === key ? 'text-primary-500' : 'text-gray-600'}`}>
                      {info.label}
                    </p>
                  </button>
                ))}
              </div>
              {errors.category && (
                <p role="alert" className="mt-2 text-sm text-red-500">
                  {errors.category}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="mb-6">
              <Input
                label="Title *"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('items.titlePlaceholderLost')}
                error={errors.title}
                helperText="Be specific - include color, brand, model"
              />
            </div>

            {/* Description */}
            <div className="mb-6">
              <Textarea
                label="Description *"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('items.descPlaceholderLost')}
                rows={4}
                error={errors.description}
              />
            </div>

            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Camera className="w-4 h-4 inline mr-1" aria-hidden="true" />
                Photos (Optional)
              </label>
              <p className="text-sm text-gray-500 mb-3">Upload photos of your item if you have any. This helps finders identify it.</p>

              <div className="grid grid-cols-3 gap-3 mb-3">
                {imagesPreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-primary-400 flex flex-col items-center justify-center transition-colors"
                  >
                    <Upload className="w-6 h-6 text-gray-400 mb-1" />
                    <span className="text-xs text-gray-500">Add Photo</span>
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                aria-label="Upload item photos"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <p className="text-xs text-gray-500">Max 5 images, 5MB each. JPEG, PNG, or WebP.</p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleNext}>
                Next: Location & Date
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Location & Date */}
        {step === 2 && (
          <Card className="p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Where and when did you lose it?</h2>

            {/* Location */}
            <div className="mb-6">
              <label htmlFor="location-area" className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 inline mr-1" aria-hidden="true" />
                Location Area *
              </label>
              <select
                id="location-area"
                value={formData.location_area}
                onChange={(e) => setFormData({ ...formData, location_area: e.target.value })}
                aria-invalid={!!errors.location_area}
                aria-describedby={errors.location_area ? 'location-area-error' : undefined}
                className={`input ${errors.location_area ? 'border-red-500' : ''}`}
              >
                <option value="">{t('items.selectLocation')}</option>
                {RWANDA_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              {errors.location_area && (
                <p id="location-area-error" role="alert" className="mt-1 text-sm text-red-500">
                  {errors.location_area}
                </p>
              )}
            </div>

            {/* Location Hint */}
            <div className="mb-6">
              <Textarea
                label="Location Details (Optional)"
                value={formData.location_hint}
                onChange={(e) => setFormData({ ...formData, location_hint: e.target.value })}
                placeholder={t('items.locationHintPlaceholderLost')}
                rows={2}
              />
            </div>

            {/* Date */}
            <div className="mb-6">
              <label htmlFor="lost-date" className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" aria-hidden="true" />
                Date Lost *
              </label>
              <input
                id="lost-date"
                type="date"
                value={formData.lost_date}
                onChange={(e) => setFormData({ ...formData, lost_date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                aria-invalid={!!errors.lost_date}
                aria-describedby={errors.lost_date ? 'lost-date-error' : undefined}
                className={`input ${errors.lost_date ? 'border-red-500' : ''}`}
              />
              {errors.lost_date && (
                <p id="lost-date-error" role="alert" className="mt-1 text-sm text-red-500">
                  {errors.lost_date}
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleSubmit} loading={loading}>
                <Check className="w-4 h-4 mr-2" />
                Submit Report
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
};

export default ReportLostPage;