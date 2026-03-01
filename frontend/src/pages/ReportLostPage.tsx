import React, { useState } from 'react';
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
  Shield,
  AlertCircle,
} from 'lucide-react';
import { Button, Card, Input, Textarea, Alert } from '../components/ui';
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

  // 2-step wizard
  const [step, setStep] = useState(1);
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
    lost_date: new Date().toISOString().split('T')[0],
  });

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (currentStep === 1) {
      if (!formData.category) newErrors.category = 'Please select a category';
      if (!formData.title || formData.title.length < 3)
        newErrors.title = 'Title must be at least 3 characters';
      if (!formData.description || formData.description.length < 10)
        newErrors.description = 'Description must be at least 10 characters';
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
    if (!validateStep(2)) return;

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
      const response = await lostItemsApi.create({
        category: formData.category,
        title: formData.title,
        description: formData.description,
        location_area: formData.location_area,
        location_hint: formData.location_hint,
        lost_date: formData.lost_date,
        ...(recaptchaToken && { recaptchaToken }),
      } as any);
      toast.success(t('reportLost.reportSuccess'));
      navigate(`/lost-items/${response.data.data.id}`);
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('reportLost.title')}</h1>
          <p className="text-gray-600">
            Describe your item and we'll help match it with found reports.
          </p>
        </div>

        {/* Privacy Notice */}
        <Alert type="info" className="mb-6">
          <Shield className="w-4 h-4 inline mr-2" />
          <strong>Privacy tip:</strong> Describe your item clearly but avoid writing your ID
          number, phone number, or bank card details here. You will verify ownership privately
          through our secure Q&amp;A system.
        </Alert>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 2 && (
                <div className={`flex-1 h-1 rounded ${step > s ? 'bg-primary-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ─── Step 1: Item Details ─── */}
        {step === 1 && (
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
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`mx-auto mb-2 ${
                        formData.category === key ? 'text-primary-500' : 'text-gray-400'
                      }`}
                    >
                      {CATEGORY_ICONS[key as ItemCategory]}
                    </div>
                    <p
                      className={`text-sm font-medium ${
                        formData.category === key ? 'text-primary-500' : 'text-gray-600'
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
                placeholder={t('items.titlePlaceholderLost')}
                error={errors.title}
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <Textarea
                label="Description *"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('items.descPlaceholderLost')}
                rows={4}
                error={errors.description}
              />
              {(formData.category === 'ID' || formData.category === 'WALLET') && (
                <p className="mt-2 text-sm text-yellow-700 flex items-start gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Do NOT enter your ID number or card number here — that's verified privately.
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Describe colour, brand, size, and any distinguishing marks. Avoid sensitive
                personal data — ownership is proved through verification questions.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleNext}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* ─── Step 2: Location & Date ─── */}
        {step === 2 && (
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Location & Date</h2>

            {/* Location */}
            <div className="mb-6">
              <label
                htmlFor="lost-location-area"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <MapPin className="w-4 h-4 inline mr-1" aria-hidden="true" />
                Where did you lose it? *
              </label>
              <select
                id="lost-location-area"
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
                placeholder="e.g. Near the bus stop, outside the bank…"
                rows={2}
              />
            </div>

            {/* Date */}
            <div className="mb-6">
              <label
                htmlFor="lost-date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <Calendar className="w-4 h-4 inline mr-1" aria-hidden="true" />
                Date Lost *
              </label>
              <input
                id="lost-date"
                type="date"
                value={formData.lost_date}
                onChange={(e) => setFormData({ ...formData, lost_date: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                className={`input ${errors.lost_date ? 'border-red-500' : ''}`}
              />
              {errors.lost_date && (
                <p role="alert" className="mt-1 text-sm text-red-500">
                  {errors.lost_date}
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={handleSubmit} loading={loading}>
                {loading ? 'Submitting…' : 'Submit Report'}
                {!loading && <Check className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
};

export default ReportLostPage;