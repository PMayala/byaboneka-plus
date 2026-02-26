import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react';
import { Button, Alert } from '../components/ui';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useRecaptcha } from '../hooks/useRecaptcha';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { executeRecaptcha } = useRecaptcha();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name || formData.name.length < 2) {
      newErrors.name = t('auth.validation.nameMin');
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.validation.emailInvalid');
    }
    if (formData.phone && !/^\+?250\d{9}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = t('auth.validation.phoneInvalid');
    }
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = t('auth.validation.passwordMin');
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = t('auth.validation.passwordUppercase');
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = t('auth.validation.passwordLowercase');
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = t('auth.validation.passwordNumber');
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.validation.passwordMismatch');
    }
    if (!acceptedTerms) {
      newErrors.acceptedTerms = t('auth.validation.mustAcceptTerms');
    }
    if (!confirmedAge) {
      newErrors.confirmedAge = t('auth.validation.mustConfirmAge');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setLoading(true);
    try {
      const recaptchaToken = await executeRecaptcha('register');
      const response = await authApi.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined,
        acceptedTerms: true,
        confirmedAge: true,
        ...(recaptchaToken && { recaptchaToken })
      } as any);
      
      const { user, tokens } = response.data.data;
      login(user, tokens.accessToken, tokens.refreshToken);
      
      toast.success(t('auth.accountCreated'));
      navigate('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.message || t('auth.registrationFailed');
      if (err.response?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        err.response.data.errors.forEach((e: { field: string; message: string }) => {
          apiErrors[e.field] = e.message;
        });
        setErrors(apiErrors);
      } else {
        setErrors({ form: message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">B+</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.createAccount')}</h1>
          <p className="text-gray-600 mt-2">{t('auth.joinByaboneka')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {errors.form && (
            <Alert type="error" className="mb-6">
              {errors.form}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.fullNameLabel')} *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.name ? 'border-red-500' : ''}`}
                  placeholder={t('auth.fullNamePlaceholder')}
                  required
                />
              </div>
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.emailLabel')} *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                />
              </div>
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.phoneLabel')}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                  placeholder={t('auth.phonePlaceholder')}
                />
              </div>
              {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.passwordLabel')} *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {t('auth.passwordRequirements')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.confirmPasswordLabel')} *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`input pl-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  placeholder={t('auth.passwordPlaceholder')}
                  required
                />
              </div>
              {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
            </div>

            {/* CONSENT CHECKBOX — Gap Fix */}
            <div className="flex items-start">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  if (errors.acceptedTerms) {
                    setErrors({ ...errors, acceptedTerms: '' });
                  }
                }}
                className="mt-1 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <label htmlFor="acceptTerms" className="ml-2 text-sm text-gray-600">
                {t('auth.agreeToTermsPrefix')}{' '}
                <Link to="/terms" className="text-primary-500 hover:text-primary-600">
                  {t('auth.termsOfService')}
                </Link>
                {' '}{t('common.and')}{' '}
                <Link to="/privacy" className="text-primary-500 hover:text-primary-600">
                  {t('auth.privacyPolicy')}
                </Link>
              </label>
            </div>
            {errors.acceptedTerms && (
              <p className="text-sm text-red-500 -mt-3">{errors.acceptedTerms}</p>
            )}

            {/* AGE CONFIRMATION — Gap Fix #16 */}
            <div className="flex items-start">
              <input
                type="checkbox"
                id="confirmAge"
                checked={confirmedAge}
                onChange={(e) => {
                  setConfirmedAge(e.target.checked);
                  if (errors.confirmedAge) {
                    setErrors({ ...errors, confirmedAge: '' });
                  }
                }}
                className="mt-1 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <label htmlFor="confirmAge" className="ml-2 text-sm text-gray-600">
                {t('auth.confirmAge')}
              </label>
            </div>
            {errors.confirmedAge && (
              <p className="text-sm text-red-500 -mt-3">{errors.confirmedAge}</p>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {t('auth.createAccountBtn')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
