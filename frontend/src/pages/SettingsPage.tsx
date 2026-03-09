import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  Key,
  Bell,
  Trash2,
  Download,
  AlertTriangle,
  Info,
  Database,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button, Card, Input, Alert, Badge } from '../components/ui';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface DataExportPreview {
  total_lost_items: number;
  total_found_items: number;
  total_claims: number;
  total_messages: number;
  total_disputes: number;
  estimated_size_bytes: number;
}

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Account deletion state
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  // Data export state
  const [exportLoading, setExportLoading] = useState(false);
  const [dataPreview, setDataPreview] = useState<DataExportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name, phone: user.phone || '' });
    }
  }, [user]);

  // PROFILE UPDATE
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      toast.error(t('settings.nameRequired'));
      return;
    }
    setProfileLoading(true);
    try {
      const response = await authApi.updateProfile({
        name: profile.name,
        phone: profile.phone || undefined,
      });
      setUser(response.data.data);
      toast.success(t('settings.profileUpdated'));
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('settings.updateProfileError'));
    } finally {
      setProfileLoading(false);
    }
  };

  // PASSWORD CHANGE
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwords.current) {
      toast.error(t('settings.currentPasswordRequired'));
      return;
    }
    if (passwords.new.length < 8) {
      toast.error(t('settings.newPasswordMin'));
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.new,
      });
      setPasswords({ current: '', new: '', confirm: '' });
      toast.success(t('settings.passwordChanged'));
      logout();
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('settings.updateProfileError'));
    } finally {
      setPasswordLoading(false);
    }
  };

  // DATA EXPORT PREVIEW
  const handleDataPreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await authApi.exportDataPreview?.();
      if (response?.data?.data) {
        setDataPreview(response.data.data);
      }
    } catch (error: any) {
      toast.error(t('settings.previewLoadFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  // DATA EXPORT (Right to Portability)
  const handleDataExport = async () => {
    setExportLoading(true);
    try {
      const response = await authApi.exportData();
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
        type: 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `byaboneka-personal-data-${new Date()
        .toISOString()
        .split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(t('settings.dataExportSuccess'));
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || t('settings.exportFailed')
      );
    } finally {
      setExportLoading(false);
    }
  };

  // ACCOUNT DELETION (Right to Erasure)
  const handleAccountDelete = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      toast.error(t('settings.deleteConfirmationRequired'));
      return;
    }
    if (!deletePassword) {
      toast.error(t('settings.deletePasswordRequired'));
      return;
    }

    setDeleteLoading(true);
    try {
      await authApi.deleteAccount({
        password: deletePassword,
        confirmation: deleteConfirmation,
      });
      toast.success(t('settings.accountDeletedMsg'));
      logout();
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.message || t('settings.deleteFailed'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const getTrustLevel = (score: number) => {
    if (score >= 10)
      return { level: t('settings.trustHigh'), color: 'verified' };
    if (score >= 5)
      return { level: t('settings.trustMedium'), color: 'active' };
    if (score >= 0) return { level: t('settings.trustNew'), color: 'pending' };
    return { level: t('settings.trustLow'), color: 'danger' };
  };

  const trustInfo = getTrustLevel(user?.trust_score || 0);

  const tabs = [
    { id: 'profile', label: t('settings.profile'), icon: User },
    { id: 'security', label: t('settings.security'), icon: Shield },
    { id: 'data', label: t('settings.dataPrivacyTab'), icon: Database },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('settings.title')}
        </h1>
        <p className="text-gray-600">{t('settings.subtitle')}</p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card className="p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  type="button"
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </Card>

          {/* Trust Score Card */}
          <Card className="p-4 mt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              {t('settings.trustScore')}
            </h3>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-gray-900">
                {user?.trust_score || 0}
              </div>
              <Badge variant={trustInfo.color as any}>{trustInfo.level}</Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {t('settings.trustScoreExplanation')}
            </p>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">
                {t('settings.profileInfo')}
              </h2>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.emailLabel')}
                  </label>
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('settings.emailCannotChange')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.fullNameLabel')} *
                  </label>
                  <Input
                    value={profile.name}
                    onChange={(e) =>
                      setProfile({ ...profile, name: e.target.value })
                    }
                    placeholder={t('settings.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('auth.phoneLabel')}
                  </label>
                  <Input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    placeholder={t('settings.phonePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('settings.role')}
                  </label>
                  <Input
                    value={
                      user?.role === 'admin'
                        ? t('admin.title')
                        : user?.role === 'coop_staff'
                          ? t('admin.coopStaff')
                          : t('admin.citizen')
                    }
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <Button type="submit" loading={profileLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {t('settings.saveChanges')}
                </Button>
              </form>
            </Card>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Password Change */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                  {t('settings.changePassword')}
                </h2>
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('settings.currentPassword')}
                    </label>
                    <div className="relative">
                      <Input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwords.current}
                        onChange={(e) =>
                          setPasswords({ ...passwords, current: e.target.value })
                        }
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            current: !showPasswords.current,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPasswords.current ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('settings.newPassword')}
                    </label>
                    <div className="relative">
                      <Input
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwords.new}
                        onChange={(e) =>
                          setPasswords({ ...passwords, new: e.target.value })
                        }
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            new: !showPasswords.new,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPasswords.new ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('settings.confirmNewPassword')}
                    </label>
                    <div className="relative">
                      <Input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwords.confirm}
                        onChange={(e) =>
                          setPasswords({
                            ...passwords,
                            confirm: e.target.value,
                          })
                        }
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            confirm: !showPasswords.confirm,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" loading={passwordLoading}>
                    <Key className="w-4 h-4 mr-2" />
                    {t('settings.changePasswordBtn')}
                  </Button>
                </form>
              </Card>

              {/* Security Status */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('settings.accountSecurity')}
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {t('settings.emailVerification')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {t('settings.emailVerificationDesc')}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        user?.email_verified ? 'verified' : 'pending'
                      }
                    >
                      {user?.email_verified
                        ? t('common.verified')
                        : t('common.pending')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">
                          {t('settings.phoneVerification')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {t('settings.phoneVerificationDesc')}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={user?.phone_verified ? 'verified' : 'pending'}
                    >
                      {user?.phone_verified
                        ? t('common.verified')
                        : t('common.notSet')}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* DATA & PRIVACY TAB */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              {/* Trust Score Explanation */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-primary-500" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('settings.howTrustWorks')}
                  </h2>
                </div>
                <div className="bg-primary-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-primary-900 mb-3">
                    {t('settings.trustExplanationIntro')}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white rounded p-2">
                      <span className="text-green-600 font-medium">+3</span>
                      <span className="text-gray-600 ml-2">
                        {t('settings.trustReturnItem')}
                      </span>
                    </div>
                    <div className="bg-white rounded p-2">
                      <span className="text-green-600 font-medium">+2</span>
                      <span className="text-gray-600 ml-2">
                        {t('settings.trustSuccessfulClaim')}
                      </span>
                    </div>
                    <div className="bg-white rounded p-2">
                      <span className="text-red-600 font-medium">-2</span>
                      <span className="text-gray-600 ml-2">
                        {t('settings.trustFailedClaim')}
                      </span>
                    </div>
                    <div className="bg-white rounded p-2">
                      <span className="text-red-600 font-medium">-5</span>
                      <span className="text-gray-600 ml-2">
                        {t('settings.trustScamReport')}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Data Export with Preview */}
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Download className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('settings.exportTitle')}
                  </h2>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  {t('settings.exportDescription')}
                </p>

                {!dataPreview && (
                  <Button
                    onClick={handleDataPreview}
                    loading={previewLoading}
                    variant="secondary"
                    className="mb-4"
                  >
                    {t("settings.viewDataPreview")}
                  </Button>
                )}

            {dataPreview && (
              <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-3">
                  {t("settings.yourDataSummary")}
                </h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-blue-700">
                      {t("settings.totalClaimsLabel")}:{' '}
                      <span className="font-bold">{dataPreview.total_claims}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-700">
                      {t("settings.lostItemsLabel")}:{' '}
                      <span className="font-bold">{dataPreview.total_lost_items}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-700">
                      {t("settings.foundItemsLabel")}:{' '}
                      <span className="font-bold">{dataPreview.total_found_items}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-700">
                      {t("settings.messagesLabel")}:{' '}
                      <span className="font-bold">{dataPreview.total_messages}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-700">
                      {t("settings.disputesLabel")}:{' '}
                      <span className="font-bold">{dataPreview.total_disputes}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-700">
                      {t("settings.estimatedSizeLabel")}:{' '}
                      <span className="font-bold">
                        {(dataPreview.estimated_size_bytes / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

                <Button
                  onClick={handleDataExport}
                  loading={exportLoading}
                  variant="secondary"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('settings.downloadMyData')}
                </Button>
              </Card>

              {/* Account Deletion */}
              <Card className="p-6 border-red-200">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-red-900">
                    {t('settings.deleteTitle')}
                  </h2>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  {t('settings.deleteWarning')}
                </p>

                {!showDeleteSection ? (
                  <Button
                    onClick={() => setShowDeleteSection(true)}
                    variant="secondary"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('settings.deleteAccountBtn')}
                  </Button>
                ) : (
                  <div className="space-y-4 border-t pt-4 mt-4">
                    <Alert type="error">{t('settings.deleteIrreversible')}</Alert>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('settings.enterPassword')}
                      </label>
                      <Input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('settings.typeDeleteConfirmation')}
                      </label>
                      <Input
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="DELETE MY ACCOUNT"
                        className={
                          deleteConfirmation === 'DELETE MY ACCOUNT'
                            ? 'border-red-500'
                            : ''
                        }
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleAccountDelete}
                        loading={deleteLoading}
                        disabled={
                          deleteConfirmation !== 'DELETE MY ACCOUNT' ||
                          !deletePassword
                        }
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t('settings.confirmDelete')}
                      </Button>
                      <Button
                        onClick={() => {
                          setShowDeleteSection(false);
                          setDeleteConfirmation('');
                          setDeletePassword('');
                        }}
                        variant="secondary"
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;