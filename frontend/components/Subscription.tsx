import React, { useState } from 'react';
import { Check, CreditCard, Shield, Zap, Loader2, X } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

// CONFIGURAÇÃO DO STRIPE
const STRIPE_PUBLIC_KEY = 'pk_test_TYooMQauvdEDq54NiTphI7jx'; 

// Inicializa o Stripe
const stripePromise = loadStripe(STRIPE_PUBLIC_KEY);

interface SubscriptionProps {
  onSubscribe: () => void;
  onLogout: () => void;
  username: string;
}

export const Subscription: React.FC<SubscriptionProps> = ({ onSubscribe, onLogout, username }) => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubscribe = async (plan: 'free' | 'basic' | 'pro') => {
    setIsLoading(true);
    setErrorMsg('');

    if (plan === 'free') {
      // Free plan logic: just activate immediately
      setTimeout(() => {
        setIsLoading(false);
        showToast(t.subscription.messages.successFree, "success");
        onSubscribe();
      }, 1000);
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network request
      
      // Simulate a successful redirect back to the app
      const successUrl = `${window.location.origin}?subscription_success=true&plan=${plan}`;
      window.location.href = successUrl;

    } catch (error: any) {
      console.error("Erro no pagamento:", error);
      setErrorMsg(t.subscription.messages.errorPayment);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full text-center mb-10 animate-fade-in-up">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">{t.subscription.title}</h1>
        <p className="text-lg text-slate-600">
          {t.subscription.subtitle.replace('{username}', username)}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl w-full">
        
        {/* Free Tier */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors shadow-sm hover:shadow-md flex flex-col">
          <h3 className="text-xl font-semibold text-slate-600">{t.subscription.plans.free.name}</h3>
          <div className="my-4">
            <span className="text-4xl font-bold text-slate-800">{t.subscription.currency} {t.subscription.plans.free.price}</span>
            <span className="text-slate-500">{t.subscription.perMonth}</span>
          </div>
          <ul className="space-y-3 mb-8 text-left text-slate-500 flex-1">
            {t.subscription.plans.free.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2">
                {i < 2 ? <Check className="w-5 h-5 text-slate-400" /> : <X className="w-5 h-5 text-slate-300" />}
                {feature}
              </li>
            ))}
          </ul>
          <button 
            onClick={() => handleSubscribe('free')}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.subscription.plans.free.cta}
          </button>
        </div>

        {/* Basic Tier */}
        <div className="bg-white p-6 rounded-2xl border border-teal-200 hover:border-teal-400 transition-colors shadow-sm hover:shadow-md flex flex-col relative">
          <h3 className="text-xl font-semibold text-teal-700">{t.subscription.plans.basic.name}</h3>
          <div className="my-4">
            <span className="text-4xl font-bold text-slate-900">{t.subscription.currency} {t.subscription.plans.basic.price}</span>
            <span className="text-slate-600">{t.subscription.perMonth}</span>
          </div>
          <ul className="space-y-3 mb-8 text-left text-slate-600 flex-1">
            {t.subscription.plans.basic.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2">
                {i < 3 ? <Check className="w-5 h-5 text-teal-600" /> : <X className="w-5 h-5 text-slate-400" />}
                {feature}
              </li>
            ))}
          </ul>
          <button 
            onClick={() => handleSubscribe('basic')}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border-2 border-teal-600 text-teal-600 font-bold hover:bg-teal-50 transition-colors"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.subscription.plans.basic.cta}
          </button>
        </div>

        {/* Pro Tier */}
        <div className="bg-white p-6 rounded-2xl border-2 border-teal-500 shadow-xl relative transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
          <div className="absolute top-0 right-0 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
            {t.subscription.recommended}
          </div>
          <h3 className="text-xl font-semibold text-slate-800">{t.subscription.plans.pro.name}</h3>
          <div className="my-4">
            <span className="text-4xl font-bold text-slate-900">{t.subscription.currency} {t.subscription.plans.pro.price}</span>
            <span className="text-slate-600">{t.subscription.perMonth}</span>
          </div>
          <p className="text-sm text-slate-500 mb-6">{t.subscription.plans.pro.description}</p>
          
          <ul className="space-y-3 mb-8 text-left flex-1">
            {t.subscription.plans.pro.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-slate-700">
                <div className="bg-teal-100 p-1 rounded-full">
                  {i === 4 ? <Shield className="w-4 h-4 text-teal-600" /> : (i === 0 ? <Zap className="w-4 h-4 text-teal-600" /> : <Check className="w-4 h-4 text-teal-600" />)}
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <button 
            onClick={() => handleSubscribe('pro')}
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-teal-600 text-white font-bold text-lg hover:bg-teal-700 transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> {t.subscription.plans.pro.redirecting}
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" /> {t.subscription.plans.pro.cta}
              </>
            )}
          </button>
        </div>
      </div>
      
      {errorMsg && (
        <div className="mt-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 max-w-md">
          {errorMsg}
        </div>
      )}
      
      <p className="text-xs text-center text-slate-400 mt-8 mb-4">
        {t.subscription.cancelAnytime}
      </p>

      <button 
        onClick={onLogout}
        className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium"
      >
        <X className="w-4 h-4" /> {t.subscription.logoutPrompt}
      </button>
    </div>
  );
};
