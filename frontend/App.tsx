import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/views/Dashboard';
import { Login } from './components/Login';
import { Subscription } from './components/Subscription';
import { User, Language } from './types';
import { useToast } from './context/ToastContext';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const App: React.FC = () => {
  console.log("[App] Component rendering...");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('pt');
  const { showToast } = useToast();

  useEffect(() => {
    // 1. Firebase Auth Session Observer
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        console.log("[Auth] Firebase session detected:", firebaseUser.email);
        try {
          // Get Firebase ID Token
          const token = await firebaseUser.getIdToken();
          
          // Fetch additional profile data from our backend
          // We use e-mail as the identifier for now, or we can use UID
          const response = await fetch(`/api/users/${encodeURIComponent(firebaseUser.email || "")}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const profileData = await response.json();
            const userSession: User = { 
              ...profileData,
              isAuthenticated: true,
              token: token // Store token optionally for future requests
            };
            setUser(userSession);
            localStorage.setItem('labprocessor_user', JSON.stringify(userSession));
          } else if (response.status === 404) {
            // Profile doesn't exist yet in Firestore, but authenticated in Auth
            // We can create a default profile or let them register
            const defaultUser: User = {
              username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User",
              email: firebaseUser.email || "",
              uid: firebaseUser.uid,
              subscriptionStatus: 'inactive',
              isAuthenticated: true,
              token: token
            };
            setUser(defaultUser);
          } else {
            showToast("Erro ao carregar seu perfil.", "error");
            setUser(null);
          }
        } catch (err) {
          console.error("[Auth] Session initialization error:", err);
          setUser(null);
        }
      } else {
        console.log("[Auth] No Firebase session.");
        setUser(null);
        localStorage.removeItem('labprocessor_user');
      }
      setLoading(false);
    });
    
    // 2. Language detection logic
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

    // --- STRIPE RETURN HANDLER (Adapted) ---
    const query = new URLSearchParams(window.location.search);
    if (query.get('subscription_success') === 'true' && auth.currentUser) {
      const plan = query.get('plan') as 'free' | 'basic' | 'pro' || 'free';
      
      auth.currentUser.getIdToken().then(token => {
        fetch(`/api/users/${encodeURIComponent(auth.currentUser?.email || "")}/subscription`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: 'active', plan })
        }).then(res => res.json()).then(updatedUser => {
          setUser(prev => prev ? { ...prev, ...updatedUser } : null);
          showToast(`Assinatura do plano ${plan.toUpperCase()} confirmada!`, 'success');
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      });
    }

    return () => unsubscribe();
  }, [showToast]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('labprocessor_lang', lang);
  };

  const handleLoginComplete = (email: string) => {
    // This is called by Login component after sign-in success
    // The observer handle will actually do the fetch
    console.log("[Auth] Login triggered for:", email);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleSubscriptionComplete = async () => {
    if (!user || !auth.currentUser) return;

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/users/${encodeURIComponent(user.email || user.username)}/subscription`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'active', plan: 'free' })
      });

      const updatedUser = await response.json();

      if (response.ok) {
        setUser({ ...user, ...updatedUser });
        showToast("Plano ativado com sucesso!", "success");
      } else {
        showToast("Erro ao ativar plano.", "error");
      }
    } catch (err) {
      console.error("Erro na ativação:", err);
      showToast("Erro de conexão.", "error");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      localStorage.removeItem('labprocessor_user');
    } catch (err) {
      console.error("Erro no logout:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  // 1. Not Logged In -> Show Login
  if (!user?.isAuthenticated) {
    return <Login onLogin={handleLoginComplete} />;
  }

  // 2. Logged In but Inactive -> Show Subscription
  if (user.subscriptionStatus !== 'active') {
    return <Subscription onSubscribe={handleSubscriptionComplete} onLogout={handleLogout} username={user.username || user.email || ""} />;
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
