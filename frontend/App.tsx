import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/views/Dashboard';
import { Login } from './components/Login';
import { Subscription } from './components/Subscription';
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
    
    // Language detection logic
    const savedLang = localStorage.getItem('labprocessor_lang') as Language;
    if (savedLang) {
      setLanguage(savedLang);
    } else {
      // Detect browser language
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('es')) {
        setLanguage('es');
      } else if (browserLang.startsWith('en')) {
        setLanguage('en');
      } else {
        setLanguage('pt'); // Default fallback
      }
    }

    // --- STRIPE RETURN HANDLER ---
    // Check if returning from Stripe Checkout with success
    const query = new URLSearchParams(window.location.search);
    if (query.get('subscription_success') === 'true') {
      const plan = query.get('plan') as 'free' | 'basic' | 'pro' || 'free';
      
      // If we have a saved user session (even if inactive), activate them
      const currentUserStr = localStorage.getItem('labprocessor_user');
      if (currentUserStr) {
        const currentUser = JSON.parse(currentUserStr);
        
        // Update backend
        fetch(`/api/users/${currentUser.username}/subscription`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active', plan })
        }).then(res => res.json()).then(updatedUser => {
          const userSession: User = { 
            ...updatedUser,
            isAuthenticated: true 
          };
          setUser(userSession);
          localStorage.setItem('labprocessor_user', JSON.stringify(userSession));
          showToast(`Assinatura do plano ${plan.toUpperCase()} confirmada com sucesso!`, 'success');
          
          // Clear query params to prevent re-processing on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }).catch(err => {
          console.error("Erro ao confirmar assinatura:", err);
          showToast("Erro ao confirmar assinatura no servidor.", "error");
        });
      }
    }
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('labprocessor_lang', lang);
  };

  const handleLogin = async (username: string) => {
    try {
      // Fetch full user details from backend
      const response = await fetch(`/api/users/${username}`);
      const foundUser = await response.json();
      
      if (!response.ok) {
        showToast("Erro ao carregar dados do usuário.", "error");
        return;
      }
      
      const userSession: User = { 
        ...foundUser,
        isAuthenticated: true
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

  const handleSubscriptionComplete = async () => {
    // This is called by the Free plan direct activation
    if (!user) return;

    const plan = 'free';

    try {
      // Update user status in backend
      const response = await fetch(`/api/users/${user.username}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', plan })
      });

      const updatedUser = await response.json();

      if (response.ok) {
        const userSession: User = { ...updatedUser, isAuthenticated: true };
        setUser(userSession);
        localStorage.setItem('labprocessor_user', JSON.stringify(userSession));
        showToast("Plano ativado com sucesso!", "success");
      } else {
        showToast("Erro ao ativar plano.", "error");
      }
    } catch (err) {
      console.error("Erro na ativação:", err);
      showToast("Erro de conexão.", "error");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('labprocessor_user');
  };

  // 1. Not Logged In -> Show Login
  if (!user?.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // 2. Logged In but Inactive -> Show Subscription
  if (user.subscriptionStatus !== 'active') {
    return <Subscription onSubscribe={handleSubscriptionComplete} onLogout={handleLogout} username={user.username} />;
  }

  // 3. Logged In and Active -> Show Dashboard
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
