import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Check,
  Smartphone,
  CreditCard,
  Wallet,
  Briefcase,
  Key,
  Package,
  Building,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { Button, Card, Input, Textarea, Alert } from '../components/ui';
import { foundItemsApi, duplicateApi } from '../services/api';
import { DuplicateWarning } from '../components/DuplicateWarning';
import { ItemCategory, CATEGORY_INFO, RWANDA_LOCATIONS } from '../types';
import { useAuthStore } from '../store/authStore';
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
  found_date: string;
}

const ReportFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { executeRecaptcha } = useRecaptcha();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    category: '',
    title: '',
    description: '',
    location_area: '',
    location_hint: '',
    found_date: new Date().toISOString().split('T')[0],
  });

  const isCoopStaff = user?.role === 'coop_staff';

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.category) newErrors.category = 'Please select a category';
    if (!formData.title || formData.title.length < 3)
      newErrors.title = 'Title must be at least 3 characters';
    if (!formData.description || formData.description.length < 10)
      newErrors.description = 'Description must be at least 10 characters';
    if (!formData.location_area) newErrors.location_area = 'Please select a location';
    if (!formData.found_date) newErrors.found_date = 'Please enter the date you found the item';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!showDuplicateWarning && duplicateCandidates.length === 0) {
      try {
        const dupRes = await duplicateApi.checkFound({
          category: formData.category,
          title: formData.title,
          description: formData.description,
          location_area: formData.location_area,
          found_date: formData.found_date,
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

    await submitFoundItem();
  };

  const submitFoundItem = async () => {
    setShowDuplicateWarning(false);
    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha('report_found');
      const createData = {
        category: formData.category,
        title: formData.title,
        description: formData.description,
        location_area: formData.location_area,
        location_hint: formData.location_hint || undefined,
        found_date: formData.found_date,
        cooperative_id: isCoopStaff && user?.cooperative_id ? user.cooperative_id : undefined,
        ...(recaptchaToken && { recaptchaToken }),
      };
      const response = await foundItemsApi.create(createData as any);
      const itemId = response.data.data.id;
      toast.success(t('reportFound.reportSuccess'));
      navigate(`/found-items/${itemId}`);
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
          itemType="found"
          onContinue={() => submitFoundItem()}
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('reportFound.title')}</h1>
          <p className="text-gray-600">
            Thank you for helping reunite someone with their belongings!
          </p>
        </div>

        {/* Privacy Notice */}
        <Alert type="info" className="mb-6">
          <Shield className="w-4 h-4 inline mr-2" />
          <strong>Privacy first:</strong> Describe the item using text only. Do{' '}
          <strong>not</strong> include personal data such as ID numbers, names, phone numbers, or
          bank card details. The owner will verify ownership through secure questions.
        </Alert>

        {isCoopStaff && (
          <Alert type="info" className="mb-6">
            <Building className="w-4 h-4 inline mr-2" />
            You're reporting as a <strong>Cooperative Staff</strong>. This item will be associated
            with your cooperative and held for secure pickup.
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* ─── Item Details ─── */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Item Details</h2>

            {/* Category */}
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
                    <div
                      className={`mx-auto mb-2 ${
                        formData.category === key ? 'text-trust-500' : 'text-gray-400'
                      }`}
                    >
                      {CATEGORY_ICONS[key as ItemCategory]}
                    </div>
                    <p
                      className={`text-sm font-medium ${
                        formData.category === key ? 'text-trust-500' : 'text-gray-600'
                      }`}
                    >
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
                placeholder={t('items.titlePlaceholderFound')}
                error={errors.title}
              />
            </div>

            {/* Description */}
            <div className="mb-6">
              <Textarea
                label="Description *"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('items.descPlaceholderFound')}
                rows={4}
                error={errors.description}
              />
              {(formData.category === 'ID' || formData.category === 'WALLET') && (
                <p className="mt-2 text-sm text-yellow-700 flex items-start gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Do NOT include personal ID numbers, card numbers, names, or any sensitive data in
                  the description.
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Describe the item's appearance, colour, make, or distinguishing marks. The genuine
                owner will prove ownership through verification questions — you don't need to
                include private data.
              </p>
            </div>
          </Card>

          {/* ─── Location & Date ─── */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Location & Date</h2>

            {/* Location */}
            <div className="mb-6">
              <label
                htmlFor="found-location-area"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <MapPin className="w-4 h-4 inline mr-1" aria-hidden="true" />
                Where did you find it? *
              </label>
              <select
                id="found-location-area"
                value={formData.location_area}
                onChange={(e) => setFormData({ ...formData, location_area: e.target.value })}
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
                <p role="alert" className="mt-1 text-sm text-red-500">
                  {errors.location_area}
                </p>
              )}
            </div>

            {/* Location Hint */}
            <div className="mb-6">
              <Textarea
                label="Specific Location (Optional)"
                value={formData.location_hint}
                onChange={(e) => setFormData({ ...formData, location_hint: e.target.value })}
                placeholder="e.g. Near the bus stop, inside the supermarket…"
                rows={2}
              />
            </div>

            {/* Date */}
            <div className="mb-2">
              <label
                htmlFor="found-date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <Calendar className="w-4 h-4 inline mr-1" aria-hidden="true" />
                Date Found *
              </label>
              <input
                id="found-date"
                type="date"
                value={formData.found_date}
                onChange={(e) => setFormData({ ...formData, found_date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className={`input ${errors.found_date ? 'border-red-500' : ''}`}
              />
              {errors.found_date && (
                <p role="alert" className="mt-1 text-sm text-red-500">
                  {errors.found_date}
                </p>
              )}
            </div>
          </Card>

          {/* ─── Important Notice ─── */}
          <Alert type="warning" className="mb-6">
            <strong>Important:</strong> Never demand payment before verification. Byaboneka+ uses
            secure questions to confirm ownership. Attempting to extort money is against our
            policies and may result in account suspension.
          </Alert>

          {/* ─── Submit ─── */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {loading ? 'Submitting…' : 'Submit Report'}
              {!loading && <Check className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default ReportFoundPage;