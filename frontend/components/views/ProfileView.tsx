import React, { useState, useEffect } from 'react';
import { User, Language } from '../../types';
import { User as UserIcon, Mail, Building, Briefcase, Save, Lock, Key, ShieldCheck } from 'lucide-react';
import { translations } from '../../utils/translations';
import { useToast } from '../../context/ToastContext';

interface ProfileViewProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  language: Language;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdateUser, language }) => {
  const t = translations[language].profile;
  const { showToast } = useToast();

  // Personal Info State
  const [formData, setFormData] = useState<Partial<User>>({
    fullName: user.fullName || '',
    email: user.email || '',
    company: user.company || '',
    role: user.role || '',
  });

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    setFormData({
      fullName: user.fullName || '',
      email: user.email || '',
      company: user.company || '',
      role: user.role || '',
    });
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = { ...user, ...formData };
    
    // Update in local storage
    const storedUsers = JSON.parse(localStorage.getItem('labprocessor_users') || '[]');
    const updatedUsersList = storedUsers.map((u: any) => 
      u.username === user.username ? { ...u, ...formData } : u
    );
    localStorage.setItem('labprocessor_users', JSON.stringify(updatedUsersList));
    
    // Update current session
    onUpdateUser(updatedUser);
    showToast(t.successUpdate, 'success');
  };

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showToast(t.errorPass, 'error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast(t.errorMatch, 'error');
      return;
    }

    // Verify current password against "database"
    const storedUsers = JSON.parse(localStorage.getItem('labprocessor_users') || '[]');
    const userIndex = storedUsers.findIndex((u: any) => u.username === user.username);

    if (userIndex === -1) {
      showToast(t.errorUser, 'error');
      return;
    }

    const storedUser = storedUsers[userIndex];

    if (storedUser.password !== passwordData.currentPassword) {
      showToast(t.errorCurrent, 'error');
      return;
    }

    // Update password
    storedUsers[userIndex].password = passwordData.newPassword;
    localStorage.setItem('labprocessor_users', JSON.stringify(storedUsers));

    showToast(t.successPass, 'success');
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
      
      {/* Personal Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex items-center gap-4">
          <div className="bg-teal-100 p-4 rounded-full">
            <UserIcon className="w-8 h-8 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{t.title}</h2>
            <p className="text-slate-500 text-sm">{t.subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleSubmitProfile} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.fullName}</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.company}</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="Nome da empresa"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.role}</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="Ex: Analista Sênior"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {t.user}: <span className="font-mono font-semibold text-slate-700">{user.username}</span>
            </div>
            
            <button
              type="submit"
              className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-sm"
            >
              <Save className="w-4 h-4" /> {t.save}
            </button>
          </div>

        </form>
      </div>

      {/* Password Change Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex items-center gap-4">
          <div className="bg-amber-100 p-4 rounded-full">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{t.securityTitle}</h2>
            <p className="text-slate-500 text-sm">{t.securitySubtitle}</p>
          </div>
        </div>

        <form onSubmit={handleSubmitPassword} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.currentPass}</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.newPass}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t.confirmPass}</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 bg-slate-800 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-700 transition-colors shadow-sm"
            >
              <Lock className="w-4 h-4" /> {t.updatePass}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
};
