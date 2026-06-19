import React, { useState } from 'react';
import { AnalysisResult } from '../../types';
import { ScrollText, ChevronRight, ChevronDown, Beaker, ClipboardList, Info } from 'lucide-react';

interface StandardsViewProps {
  results: AnalysisResult[];
}

const StandardsView: React.FC<StandardsViewProps> = ({ results }) => {
  // Flatten and sort standards
  const allStandards = React.useMemo(() => {
    const flattened: any[] = [];
    results.forEach(res => {
      const standards = [...(res.standards || [])];
      
      // Legacy fallback
      if (standards.length === 0 && res.reagents) {
        res.reagents.forEach(r => {
          const name = r.name || '';
          if (name.toLowerCase().includes('padrão') || name.toLowerCase().includes('padrao')) {
            standards.push({
              name: r.name,
              amountmg: (r as any).specification || '-',
              concentration: '-',
              testName: r.testName
            });
          }
        });
      }

      standards.forEach(s => {
        flattened.push({
          ...s,
          productName: res.product.productName,
          fileName: res.fileName
        });
      });
    });
    return flattened.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [results]);

  const [searchTerm, setSearchTerm] = useState('');
  const filteredStandards = allStandards.filter(s => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.testName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <ScrollText className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Padrões de Referência</h2>
            <p className="text-sm text-slate-500">Listagem consolidada por ordem alfabética.</p>
          </div>
        </div>

        <div className="relative max-w-xs w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <ClipboardList className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar padrão ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {filteredStandards.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Padrão</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Produto</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Quantidade (mg)</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Conc. Solução</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Utilizado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStandards.map((std, idx) => (
                  <tr key={`${std.name}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2 rounded-lg shrink-0">
                          <Beaker className="w-4 h-4 text-indigo-500" />
                        </div>
                        <span className="font-bold text-slate-800 leading-tight">{std.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded-md inline-block">
                        {std.productName}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[150px]" title={std.fileName}>
                        {std.fileName}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">
                        {std.amountmg || (std as any).purity || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 font-medium">
                      {std.concentration || '-'}
                    </td>
                    <td className="px-4 py-4">
                      {std.testName ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-[200px]">
                          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="line-clamp-2 italic">{std.testName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Não especificado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
          <ScrollText className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Nenhum padrão encontrado.</p>
          <p className="text-slate-400 text-sm mt-1">Tente ajustar sua busca ou processe novos arquivos.</p>
        </div>
      )}
    </div>
  );
};

export default StandardsView;
