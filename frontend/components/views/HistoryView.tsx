import React, { useState, useMemo } from 'react';
import { HistoryItem } from '../../types';
import { Clock, FileText, Trash2, FlaskConical, Bug, Search } from 'lucide-react';

interface HistoryViewProps {
  history: HistoryItem[];
  onClear: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onClear }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(item => 
      item.productName.toLowerCase().includes(term) || 
      item.fileName.toLowerCase().includes(term)
    );
  }, [history, searchTerm]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
        <Clock className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-xl font-bold text-slate-400 font-display">Histórico vazio</h3>
        <p className="text-slate-400 text-sm mt-1">Os documentos processados aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Histórico de Processamento</h3>
          <p className="text-slate-500 text-sm">Registro completo de todos os métodos analisados.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por produto ou arquivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={onClear}
            className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 border border-red-100"
          >
            <Trash2 className="w-4 h-4" /> Limpar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Produto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Arquivo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Físico-Químico</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Microbiologia</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Tempo Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{new Date(item.date).toLocaleDateString()}</span>
                        <span className="text-[10px] text-slate-400 font-mono italic">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">{item.productName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[150px]" title={item.fileName}>{item.fileName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-700 rounded-lg border border-teal-100/50 text-xs font-black">
                        <FlaskConical className="w-3 h-3" />
                        <span>{item.totalTimePhysChem?.toFixed(2) || '0.00'}h</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-pink-50 text-pink-700 rounded-lg border border-pink-100/50 text-xs font-black">
                        <Bug className="w-3 h-3" />
                        <span>{item.totalTimeMicro?.toFixed(2) || '0.00'}h</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-0.5 rounded-lg border border-slate-200 shadow-sm inline-block min-w-20 flex items-center justify-center gap-1" title="Maior tempo (FQ ou Micro)">
                          {item.totalTime.toFixed(2)} h
                        </span>
                        {item.workloadTime && (
                          <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase leading-none" title="Carga de Trabalho Total (Somatória)">
                            Σ: {item.workloadTime.toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum resultado encontrado para "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
