import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, ArrowRight, Check, Smartphone, CreditCard, 
  Wallet, Briefcase, Key, Package, MapPin, Calendar,
  HelpCircle, Shield, AlertCircle
} from 'lucide-react';
import { Button, Card, Input, Textarea, Select, Alert } from '../components/ui';
import { lostItemsApi } from '../services/api';
import { ItemCategory, CATEGORY_INFO, RWANDA_LOCATIONS, QUESTION_TEMPLATES, VerificationQuestion } from '../types';
import toast from 'react-hot-toast';

const CATEGORY_OPTIONS = Object.entries(CATEGORY_INFO).map(([value, info]) => ({
  value,
  label: info.label,
}));

const LOCATION_OPTIONS = RWANDA_LOCATIONS.map((loc) => ({ value: loc, label: loc }));

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
  verification_questions: VerificationQuestion[];
}

const ReportLostPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormData>({
    category: '',
    title: '',
    description: '',
    location_area: '',
    location_hint: '',
    lost_date: new Date().toISOString().split('T')[0],
    verification_questions: [
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
    ],
  });

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.category) newErrors.category = 'Please select a category';
      if (!formData.title || formData.title.length < 3) newErrors.title = 'Title must be at least 3 characters';
      if (!formData.description || formData.description.length < 10) {
        newErrors.description = 'Description must be at least 10 characters';
      }
    }

    if (currentStep === 2) {
      if (!formData.location_area) newErrors.location_area = 'Please select a location';
      if (!formData.lost_date) newErrors.lost_date = 'Please enter the date you lost the item';
    }

    if (currentStep === 3) {
      formData.verification_questions.forEach((q, i) => {
        if (!q.question || q.question.length < 5) {
          newErrors[`question_${i}`] = 'Question must be at least 5 characters';
        }
        if (!q.answer || q.answer.length < 1) {
          newErrors[`answer_${i}`] = 'Answer is required';
        }
      });
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
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      const response = await lostItemsApi.create({
        ...formData,
        verification_questions: formData.verification_questions.map((q) => ({
          question: q.question,
          answer: q.answer,
        })),
      });

      toast.success('Lost item reported successfully!');
      navigate(`/lost-items/${response.data.data.id}`);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to submit report';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...formData.verification_questions];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, verification_questions: updated });
  };

  const suggestedQuestions = formData.category 
    ? QUESTION_TEMPLATES[formData.category as ItemCategory] || []
    : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Lost Item</h1>
        <p className="text-gray-600">
          Provide details about your lost item to help us match it with found items
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map((s) => (
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
                {s === 1 ? 'Item Details' : s === 2 ? 'Location & Date' : 'Verification'}
              </span>
            </div>
            {s < 3 && <div className={`flex-1 h-1 mx-4 rounded ${s < step ? 'bg-trust-500' : 'bg-gray-200'}`} />}
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
                    formData.category === key
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
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
            {errors.category && <p className="mt-2 text-sm text-red-500">{errors.category}</p>}
          </div>

          {/* Title */}
          <div className="mb-6">
            <Input
              label="Title *"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Black iPhone 13 Pro with blue case"
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
              placeholder="Describe your item in detail. Include any unique marks, scratches, stickers, or identifiers..."
              rows={4}
              error={errors.description}
            />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location Area *
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
              label="Location Details (Optional)"
              value={formData.location_hint}
              onChange={(e) => setFormData({ ...formData, location_hint: e.target.value })}
              placeholder="e.g., Near the main bus station, inside a moto taxi..."
              rows={2}
            />
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date Lost *
            </label>
            <input
              type="date"
              value={formData.lost_date}
              onChange={(e) => setFormData({ ...formData, lost_date: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className={`input ${errors.lost_date ? 'border-red-500' : ''}`}
            />
            {errors.lost_date && <p className="mt-1 text-sm text-red-500">{errors.lost_date}</p>}
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleNext}>
              Next: Verification Questions
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Verification Questions */}
      {step === 3 && (
        <Card className="p-6 animate-fade-in">
          <div className="flex items-start gap-3 mb-6">
            <Shield className="w-6 h-6 text-trust-500 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Set Verification Questions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create 3 questions that only the true owner would know. These prevent fraudulent claims.
              </p>
            </div>
          </div>

          <Alert type="info" className="mb-6">
            <strong>Tips:</strong> Ask about unique details like scratches, personal photos, app layouts, 
            or things that wouldn't be visible to someone who found your item.
          </Alert>

          {formData.verification_questions.map((q, index) => (
            <div key={index} className="mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="font-medium text-gray-700">Question {index + 1}</span>
              </div>

              <div className="mb-3">
                <Input
                  value={q.question}
                  onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                  placeholder="Enter your verification question..."
                  error={errors[`question_${index}`]}
                />
                {suggestedQuestions.length > 0 && !q.question && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Suggestions:</p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedQuestions.slice(0, 3).map((suggestion, si) => (
                        <button
                          key={si}
                          type="button"
                          onClick={() => updateQuestion(index, 'question', suggestion)}
                          className="text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:border-primary-300 hover:bg-primary-50"
                        >
                          {suggestion.substring(0, 40)}...
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Input
                value={q.answer}
                onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                placeholder="Your answer (only you should know this)"
                error={errors[`answer_${index}`]}
              />
            </div>
          ))}

          <Alert type="warning" className="mb-6">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            <strong>Remember your answers!</strong> You'll need them to verify ownership if someone 
            claims to have found your item. Answers are not case-sensitive.
          </Alert>

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
  );
};

export default ReportLostPage;
