import React, { useState, useCallback } from 'react';
import { Search, Loader2, ArrowRight } from 'lucide-react';

interface MfvcqSearchProps {
  onSelectProduct: (produto: any) => void;
}

export const MfvcqSearch: React.FC<MfvcqSearchProps> = ({ onSelectProduct }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/mfvcq/search?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  let timer: any;
  const handleChange = (v: string) => {
    setQuery(v);
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(v), 300);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Search className="w-5 h-5 text-teal-600" />
        Buscar Produto
      </h3>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
          placeholder="Digite código, ativo ou descrição..."
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
      </div>

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs font-bold uppercase border-b border-slate-200">
                <th className="text-left pb-2">Código</th>
                <th className="text-left pb-2">Descrição</th>
                <th className="text-left pb-2">Ativo</th>
                <th className="text-left pb-2">Célula</th>
                <th className="text-right pb-2">Média</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {results.map((p, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-2 font-mono text-xs">{p.codigo_pa}</td>
                  <td className="py-2 pr-2 font-medium text-slate-800 max-w-[200px] truncate">{p.descricao}</td>
                  <td className="py-2 pr-2 text-slate-600">{p.ativo}</td>
                  <td className="py-2 pr-2">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs">{p.celula}</span>
                  </td>
                  <td className="py-2 pr-2 text-right font-mono">{Math.round(p.media_12_meses || 0)}</td>
                  <td className="py-2">
                    <button
                      onClick={() => onSelectProduct(p)}
                      className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"
                      title="Analisar este produto"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query && !loading && results.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">Nenhum produto encontrado</p>
      )}
    </div>
  );
};
