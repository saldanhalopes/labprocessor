import React, { useState } from 'react';
import { MfvcqForm } from '../mfvcq/MfvcqForm';
import { MfvcqResult } from '../mfvcq/MfvcqResult';
import { MfvcqSearch } from '../mfvcq/MfvcqSearch';
import { BarChart3 } from 'lucide-react';

interface MfvcqViewProps {
  language: string;
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export const MfvcqView: React.FC<MfvcqViewProps> = ({ language, showToast }) => {
  const [result, setResult] = useState<any>(null);

  const handleSearchResult = (produto: any) => {
    showToast(`Produto selecionado: ${produto.descricao}`, 'success');
  };

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
          <BarChart3 className="w-8 h-8 text-teal-600" />
          MFVCQ — Demanda e Capacidade
        </h2>
        <p className="text-slate-500 mt-2">
          Analise fluxos de CQ, calcule demanda e consulte o catálogo de produtos
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <MfvcqSearch onSelectProduct={handleSearchResult} />
        <MfvcqForm onResult={setResult} onSearchResult={handleSearchResult} language={language} />
      </div>

      {result && <MfvcqResult result={result} />}
    </div>
  );
};
