import React, { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

interface SubscriptionProps {
  onSubscribe: () => void;
  onLogout: () => void;
  username: string;
}

export const Subscription: React.FC<SubscriptionProps> = ({ onSubscribe, onLogout, username }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleActivate = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSubscribe();
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center mb-10 animate-fade-in-up">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Bem-vindo ao LabProcessor</h1>
        <p className="text-lg text-slate-600">
          Olá, <span className="font-semibold text-teal-600">{username}</span>. Clique abaixo para ativar seu acesso.
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
        <h3 className="text-xl font-semibold text-slate-800 mb-4">Acesso Liberado</h3>
        <ul className="space-y-3 mb-8 text-left text-slate-600">
          <li className="flex items-center gap-2"><Check className="w-5 h-5 text-teal-600" /> Upload e análise de PDFs</li>
          <li className="flex items-center gap-2"><Check className="w-5 h-5 text-teal-600" /> Chat com IA sobre documentos</li>
          <li className="flex items-center gap-2"><Check className="w-5 h-5 text-teal-600" /> Histórico completo</li>
          <li className="flex items-center gap-2"><Check className="w-5 h-5 text-teal-600" /> Armazenamento local</li>
        </ul>

        <button
          onClick={handleActivate}
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 transition-colors shadow-sm"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Ativar Acesso'}
        </button>
      </div>

      <button
        onClick={onLogout}
        className="flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium mt-8"
      >
        <X className="w-4 h-4" /> Sair
      </button>
    </div>
  );
};
