import React, { useEffect, useState, useCallback } from 'react';
import { Search, Brain, Trash2, RefreshCw, Plus, Clock, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';

interface Memory {
  id: string;
  memory: string;
  created_at?: string;
}

export const Mem0View: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Memory[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [adding, setAdding] = useState(false);

  const API = 'http://192.168.15.59:8082';

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/memory/recent?limit=50`);
      const data = await res.json();
      setMemories(data.results || []);
    } catch (e) {
      console.error('mem0 load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecent(); }, [loadRecent]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${API}/api/memory/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error('mem0 search error:', e);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      await fetch(`${API}/api/memory/remember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      });
      setNewContent('');
      loadRecent();
    } catch (e) {
      console.error('mem0 add error:', e);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API}/api/memory/${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
      if (searchResults) setSearchResults(prev => (prev || []).filter(m => m.id !== id));
    } catch (e) {
      console.error('mem0 delete error:', e);
    }
  };

  const displayList = searchResults || memories;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Mem0 — Memória IA</h2>
              <p className="text-xs text-slate-500">{memories.length} memórias armazenadas</p>
            </div>
          </div>
          <button onClick={loadRecent} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Atualizar">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Add new memory */}
      <div className="px-6 py-3 bg-purple-50/50 border-b border-purple-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Nova memória... (Enter para salvar)"
            className="flex-1 px-3 py-2 border border-purple-200 rounded-lg text-sm outline-none focus:border-purple-400 bg-white"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newContent.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b border-slate-200 bg-white">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar memórias..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-purple-400"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
          </button>
          {searchResults && (
            <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700">
              Limpar
            </button>
          )}
        </div>
        {searchResults && (
          <p className="text-xs text-purple-600 mt-2">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{searchQuery}"</p>
        )}
      </div>

      {/* Memory list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Brain className="w-12 h-12 mb-4 text-slate-300" />
            <p className="text-sm font-medium">Nenhuma memória encontrada</p>
            <p className="text-xs mt-1">Faça upload de um método ou adicione via chat para começar</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayList.map(m => (
              <div key={m.id} className="px-6 py-4 hover:bg-purple-50/30 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-relaxed">{m.memory}</p>
                    {m.created_at && (
                      <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(m.created_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
