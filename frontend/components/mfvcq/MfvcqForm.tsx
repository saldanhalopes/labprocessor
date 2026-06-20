import React, { useState, useEffect } from 'react';
import { Search, Loader2, FlaskConical, Layers } from 'lucide-react';

interface MfvcqFormProps {
  onResult: (result: any) => void;
  onSearchResult: (produto: any) => void;
  language: string;
}

export const MfvcqForm: React.FC<MfvcqFormProps> = ({ onResult, onSearchResult, language }) => {
  const [ativo, setAtivo] = useState('');
  const [forma, setForma] = useState('');
  const [mediaMensal, setMediaMensal] = useState('');
  const [fatorConversao, setFatorConversao] = useState('1');
  const [tamanhoBulk, setTamanhoBulk] = useState('');
  const [lotes, setLotes] = useState('1');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [formas, setFormas] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/mfvcq/indices').then(r => r.json()).then(data => {
      if (data.ativos) setSuggestions(data.ativos);
      if (data.formas_farmaceuticas) setFormas(data.formas_farmaceuticas);
    }).catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!ativo.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/mfvcq/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ativo: ativo.trim(),
          forma: forma || undefined,
          mediaMensal: parseFloat(mediaMensal) || 0,
          fatorConversao: parseFloat(fatorConversao) || 1,
          tamanhoBulk: parseFloat(tamanhoBulk) || 0,
          lotes: parseInt(lotes) || 1
        })
      });
      const data = await res.json();
      onResult(data);
    } catch (err) {
      console.error('Error analyzing:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-teal-600" />
        Analisar Produto
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ativo *</label>
          <input
            type="text"
            value={ativo}
            onChange={e => setAtivo(e.target.value)}
            list="ativos-list"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
            placeholder="Ex: ABIRATERONA"
          />
          <datalist id="ativos-list">
            {suggestions.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Forma Farmacêutica</label>
          <select
            value={forma}
            onChange={e => setForma(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
          >
            <option value="">Automática</option>
            {formas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">N° de Lotes</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="number" min="1" value={lotes} onChange={e => setLotes(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Média Mensal</label>
            <input type="number" value={mediaMensal} onChange={e => setMediaMensal(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fator</label>
            <input type="number" step="0.1" value={fatorConversao} onChange={e => setFatorConversao(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tamanho Bulk</label>
            <input type="number" value={tamanhoBulk} onChange={e => setTamanhoBulk(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !ativo.trim()}
          className="w-full py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Analisando...' : 'Analisar'}
        </button>
      </div>
    </div>
  );
};
