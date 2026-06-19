import React, { useState, useEffect } from 'react';
import { User, Language } from '../../types';
import { Users, Edit2, Trash2, Save, X, Shield } from 'lucide-react';
import { translations } from '../../utils/translations';
import { useToast } from '../../context/ToastContext';

interface AdminViewProps {
  currentUser: User;
  language: Language;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUser, language }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const { showToast } = useToast();

  const t = translations[language].admin;

  useEffect(() => {
    const storedUsers = JSON.parse(localStorage.getItem('labprocessor_users') || '[]');
    setUsers(storedUsers);
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user.username);
    setEditForm({ ...user });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;

    const updatedUsers = users.map(u => 
      u.username === editingUser ? { ...u, ...editForm } : u
    );

    setUsers(updatedUsers);
    localStorage.setItem('labprocessor_users', JSON.stringify(updatedUsers));
    
    setEditingUser(null);
    setEditForm({});
    showToast(t.successUpdate, 'success');
  };

  const handleDelete = (username: string) => {
    if (username === currentUser.username) {
      showToast("Você não pode excluir seu próprio usuário.", "warning");
      return;
    }

    if (window.confirm(t.confirmDelete)) {
      const updatedUsers = users.filter(u => u.username !== username);
      setUsers(updatedUsers);
      localStorage.setItem('labprocessor_users', JSON.stringify(updatedUsers));
      showToast(t.successDelete, 'success');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
        <div className="bg-indigo-100 p-3 rounded-lg">
          <Users className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t.title}</h2>
          <p className="text-slate-500 text-sm">{t.subtitle}</p>
        </div>
      </div>


      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">{t.table.user}</th>
                <th className="px-6 py-4">{t.table.name}</th>
                <th className="px-6 py-4">{t.table.email}</th>
                <th className="px-6 py-4">{t.table.role}</th>
                <th className="px-6 py-4">Plano</th>
                <th className="px-6 py-4 text-center">Admin</th>
                <th className="px-6 py-4 text-right">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.username} className="hover:bg-slate-50 transition-colors">
                  {editingUser === user.username ? (
                    <>
                      <td className="px-6 py-4 font-mono text-slate-500">{user.username}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          name="fullName"
                          value={editForm.fullName || ''}
                          onChange={handleChange}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          name="email"
                          value={editForm.email || ''}
                          onChange={handleChange}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          name="role"
                          value={editForm.role || ''}
                          onChange={handleChange}
                          className="w-full p-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          name="plan"
                          value={editForm.plan || 'free'}
                          onChange={handleChange}
                          className="w-full p-1 border rounded text-sm bg-white"
                        >
                          <option value="free">Free</option>
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          name="isAdmin"
                          checked={editForm.isAdmin || false}
                          onChange={handleChange}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={handleSaveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={handleCancelEdit} className="text-red-600 hover:bg-red-50 p-1 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 font-medium text-slate-800">{user.username}</td>
                      <td className="px-6 py-4 text-slate-600">{user.fullName || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{user.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-600">{user.role || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                          user.plan === 'pro' ? 'bg-teal-100 text-teal-700' : 
                          user.plan === 'basic' ? 'bg-blue-100 text-blue-700' : 
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {user.plan || 'Free'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user.isAdmin && <Shield className="w-4 h-4 text-indigo-600 mx-auto" />}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleEdit(user)}
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors"
                            title={t.edit}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {user.username !== currentUser.username && (
                            <button 
                              onClick={() => handleDelete(user.username)}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                              title={t.delete}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
