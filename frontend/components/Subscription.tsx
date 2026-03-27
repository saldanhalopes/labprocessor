import React, { useState } from 'react';
import { Check, CreditCard, Shield, Zap, Loader2, X } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '../context/ToastContext';

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubscribe = async (plan: 'free' | 'basic' | 'pro') => {
    setIsLoading(true);
    setErrorMsg('');

    if (plan === 'free') {
      // Free plan logic: just activate immediately
      setTimeout(() => {
        setIsLoading(false);
        showToast("Plano Gratuito ativado com sucesso!", "success");
        onSubscribe();
      }, 1000);
      return;
    }

    try {
      // --- REAL INTEGRATION PATTERN (Requires Backend) ---
      /*
      1. Call your Backend API to create a Checkout Session:
         const response = await fetch('/api/create-checkout-session', { 
           method: 'POST',
           body: JSON.stringify({ plan }) 
         });
         const session = await response.json();
      
      2. Redirect to Stripe using the Session ID:
         const stripe = await stripePromise;
         const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
      */

      // --- SIMULATION FOR FRONTEND-ONLY DEMO ---
      
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network request
      
      // Simulate a successful redirect back to the app
      const successUrl = `${window.location.origin}?subscription_success=true&plan=${plan}`;
      window.location.href = successUrl;

    } catch (error: any) {
      console.error("Erro no pagamento:", error);
      setErrorMsg("Ocorreu um erro ao processar o pagamento.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full text-center mb-10 animate-fade-in-up">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Escolha seu Plano</h1>
        <p className="text-lg text-slate-600">
          Olá, <span className="font-semibold text-teal-600">{username}</span>. Para acessar o LabProcessor, é necessária uma assinatura ativa.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-6xl w-full">
        
        {/* Free Tier */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors shadow-sm hover:shadow-md flex flex-col">
          <h3 className="text-xl font-semibold text-slate-600">Gratuito</h3>
          <div className="my-4">
            <span className="text-4xl font-bold text-slate-800">R$ 0</span>
            <span className="text-slate-500">/mês</span>
          </div>
          <ul className="space-y-3 mb-8 text-left text-slate-500 flex-1">
            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-slate-400" /> Acesso limitado</li>
            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-slate-400" /> 1 upload por dia</li>
            <li className="flex items-center gap-2"><X className="w-5 h-5 text-slate-300" /> Sem histórico</li>
            <li className="flex items-center gap-2"><X className="w-5 h-5 text-slate-300" /> Sem suporte</li>
          </ul>
          <button 
            onClick={() => handleSubscribe('free')}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Começar Grátis'}
          </button>
        </div>

        {/* Basic Tier */}
        <div className="bg-white p-6 rounded-2xl border border-teal-200 hover:border-teal-400 transition-colors shadow-sm hover:shadow-md flex flex-col relative">
          <h3 className="text-xl font-semibold text-teal-700">Básico</h3>
          <div className="my-4">
            <span className="text-4xl font-bold text-slate-900">R$ 29</span>
            <span className="text-slate-600">/mês</span>
          </div>
          <ul className="space-y-3 mb-8 text-left text-slate-600 flex-1">
            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-teal-600" /> Acesso ao sistema</li>
            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-teal-600" /> 5 uploads por dia</li>
            <li className="flex items-center gap-2"><Check className="w-5 h-5 text-teal-600" /> Histórico básico</li>
            <li className="flex items-center gap-2 text-slate-400"><X className="w-5 h-5" /> Sem suporte prioritário</li>
          </ul>
          <button 
            onClick={() => handleSubscribe('basic')}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border-2 border-teal-600 text-teal-600 font-bold hover:bg-teal-50 transition-colors"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Assinar Básico'}
          </button>
        </div>

        {/* Pro Tier */}
        <div className="bg-white p-6 rounded-2xl border-2 border-teal-500 shadow-xl relative transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
          <div className="absolute top-0 right-0 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
            RECOMENDADO
          </div>
          <h3 className="text-xl font-semibold text-slate-800">Profissional</h3>
          <div className="my-4">
            <span className="text-4xl font-bold text-slate-900">R$ 99</span>
            <span className="text-slate-600">/mês</span>
          </div>
          <p className="text-sm text-slate-500 mb-6">Acesso total a todas as ferramentas.</p>
          
          <ul className="space-y-3 mb-8 text-left flex-1">
            <li className="flex items-center gap-2 text-slate-700">
              <div className="bg-teal-100 p-1 rounded-full"><Zap className="w-4 h-4 text-teal-600" /></div>
              Uploads Ilimitados
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <div className="bg-teal-100 p-1 rounded-full"><Check className="w-4 h-4 text-teal-600" /></div>
              Análise Completa
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <div className="bg-teal-100 p-1 rounded-full"><Check className="w-4 h-4 text-teal-600" /></div>
              Extração de Reagentes
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <div className="bg-teal-100 p-1 rounded-full"><Check className="w-4 h-4 text-teal-600" /></div>
              Banco de Dados Persistente
            </li>
            <li className="flex items-center gap-2 text-slate-700">
              <div className="bg-teal-100 p-1 rounded-full"><Shield className="w-4 h-4 text-teal-600" /></div>
              Suporte Prioritário
            </li>
          </ul>

          <button 
            onClick={() => handleSubscribe('pro')}
            disabled={isLoading}
            className="w-full py-4 rounded-xl bg-teal-600 text-white font-bold text-lg hover:bg-teal-700 transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Redirecionando...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" /> Assinar Profissional
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
        Pagamento seguro via Stripe. Cancele quando quiser.
      </p>

      <button 
        onClick={onLogout}
        className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium"
      >
        <X className="w-4 h-4" /> Deseja sair? Clique aqui para encerrar sessão.
      </button>
    </div>
  );
};
