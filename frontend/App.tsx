import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/views/Dashboard';
import { Login } from './components/Login';
import { Subscription } from './components/Subscription';
import { User } from './types';
import { useToast } from './context/ToastContext';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const { t } = useLanguage();

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
          const response = await fetch(`/api/users/${encodeURIComponent(firebaseUser.email || "")}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const profileData = await response.json();
            const userSession: User = { 
              ...profileData,
              isAuthenticated: true,
              token: token
            };
            setUser(userSession);
            localStorage.setItem('labprocessor_user', JSON.stringify(userSession));
          } else {
            // New user or error, assume active/free by default to bypass landing screen
            const defaultUser: User = {
              username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User",
              email: firebaseUser.email || "",
              uid: firebaseUser.uid,
              subscriptionStatus: 'active',
              plan: 'free',
              isAuthenticated: true,
              token: token
            };
            setUser(defaultUser);
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
          showToast(t.subscription.messages.confirmSuccess.replace('{plan}', plan.toUpperCase()), 'success');
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      });
    }

    return () => unsubscribe();
  }, [showToast, t]);

  const handleLoginComplete = (email: string) => {
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
        showToast(t.common.planActivated, "success");
      } else {
        showToast(t.common.activationError, "error");
      }
    } catch (err) {
      console.error("Erro na ativação:", err);
      showToast(t.common.connectionError, "error");
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

  // 2. Logged In and Active -> Show Dashboard
  return (
    <Dashboard 
      onLogout={handleLogout} 
      user={user} 
      onUpdateUser={handleUpdateUser}
    />
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
