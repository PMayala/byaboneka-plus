import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Save, Key, Bell } from 'lucide-react';
import { Button, Card, Input, Alert, Badge } from '../components/ui';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const SettingsPage: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  
  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({ name: user.name, phone: user.phone || '' });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setProfileLoading(true);
    try {
      const response = await authApi.updateProfile({
        name: profile.name,
        phone: profile.phone || undefined,
      });
      setUser(response.data.data);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwords.current) {
      toast.error('Current password is required');
      return;
    }
    if (passwords.new.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: passwords.current,
        newPassword: passwords.new,
      });
      toast.success('Password changed successfully. Please log in again.');
      setPasswords({ current: '', new: '', confirm: '' });
      // Optionally log out user after password change
      // logout();
      // navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const getTrustLevel = (score: number) => {
    if (score >= 10) return { level: 'High', color: 'verified' };
    if (score >= 5) return { level: 'Medium', color: 'active' };
    if (score >= 0) return { level: 'New', color: 'pending' };
    return { level: 'Low', color: 'danger' };
  };

  const trustInfo = getTrustLevel(user?.trust_score || 0);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
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
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </Card>

          {/* Trust Score Card */}
          <Card className="p-4 mt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Trust Score</h3>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold text-gray-900">
                {user?.trust_score || 0}
              </div>
              <Badge variant={trustInfo.color as any}>
                {trustInfo.level}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Your trust score increases with successful returns and decreases with failed verifications.
            </p>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          {activeTab === 'profile' && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>
              
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="flex-1 bg-gray-50"
                    />
                    <Badge variant={user?.email_verified ? 'verified' : 'pending'}>
                      {user?.email_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+250 7XX XXX XXX"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Phone number is optional but recommended for account recovery
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <Input
                    value={user?.role === 'admin' ? 'Administrator' : 
                           user?.role === 'coop_staff' ? 'Cooperative Staff' : 'Citizen'}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <Button type="submit" loading={profileLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </form>
            </Card>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h2>
                
                <form onSubmit={handlePasswordChange} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      value={passwords.current}
                      onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <Input
                      type="password"
                      value={passwords.new}
                      onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Min 8 characters with uppercase, lowercase, and number
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>

                  <Button type="submit" loading={passwordLoading}>
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </form>
              </Card>

              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Security</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">Email Verification</p>
                        <p className="text-sm text-gray-500">Verify your email for account security</p>
                      </div>
                    </div>
                    <Badge variant={user?.email_verified ? 'verified' : 'pending'}>
                      {user?.email_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">Phone Verification</p>
                        <p className="text-sm text-gray-500">Verify your phone for additional security</p>
                      </div>
                    </div>
                    <Badge variant={user?.phone_verified ? 'verified' : 'pending'}>
                      {user?.phone_verified ? 'Verified' : 'Not Set'}
                    </Badge>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;