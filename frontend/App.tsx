import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/views/Dashboard';
import { Login } from './components/Login';
import { User, Language } from './types';
import { useToast } from './context/ToastContext';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<Language>('pt');
  const { showToast } = useToast();

  useEffect(() => {
    const savedUser = localStorage.getItem('labprocessor_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const savedLang = localStorage.getItem('labprocessor_lang') as Language;
    if (savedLang) {
      setLanguage(savedLang);
    } else {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('es')) {
        setLanguage('es');
      } else if (browserLang.startsWith('en')) {
        setLanguage('en');
      } else {
        setLanguage('pt');
      }
    }
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('labprocessor_lang', lang);
  };

  const handleLogin = async (username: string, token: string) => {
    try {
      const response = await fetch(`/api/users/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const foundUser = await response.json();

      if (!response.ok) {
        showToast("Erro ao carregar dados do usuário.", "error");
        return;
      }

      const userSession: User = {
        ...foundUser,
        isAuthenticated: true,
        token
      };

      setUser(userSession);
      localStorage.setItem('labprocessor_user', JSON.stringify(userSession));
    } catch (err) {
      console.error("Erro no login post-auth:", err);
      showToast("Erro de conexão ao carregar perfil.", "error");
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('labprocessor_user', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('labprocessor_user');
  };

  if (!user?.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      onLogout={handleLogout}
      user={user}
      onUpdateUser={handleUpdateUser}
      language={language}
      onLanguageChange={handleLanguageChange}
    />
  );
};

export default App;
