import React, { useState } from 'react';
import { AnalysisResult } from '../../types';
import { LayoutGrid, Search, Filter, Cpu, Database, Info } from 'lucide-react';

interface ChromatographicColumnsViewProps {
  results: AnalysisResult[];
}

const ChromatographicColumnsView: React.FC<ChromatographicColumnsViewProps> = ({ results }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Extract columns from equipments or reagents where category/name matches "Coluna"
  const columns = React.useMemo(() => {
    const list: any[] = [];
    results.forEach(res => {
      // Check equipments for "Coluna", "Column", "Columna"
      (res.equipments || []).forEach(e => {
        const nameMatch = e.name?.toLowerCase().match(/coluna|column|columna/);
        const categoryMatch = e.category?.toLowerCase().includes('coluna');
        
        if (nameMatch || categoryMatch) {
          list.push({
            name: e.name,
            model: e.model || '-',
            testName: e.testName,
            productName: res.product.productName,
            fileName: res.fileName
          });
        }
      });
      
      // Check reagents just in case (sometimes phases are described there)
      (res.reagents || []).forEach(r => {
        if (r.name?.toLowerCase().match(/coluna|column|columna/)) {
          list.push({
            name: r.name,
            model: (r as any).specification || '-',
            testName: r.testName,
            productName: res.product.productName,
            fileName: res.fileName
          });
        }
      });
    });
    return list;
  }, [results]);

  const filtered = columns.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.testName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-teal-100 p-2 rounded-lg">
            <LayoutGrid className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Colunas Cromatográficas</h2>
            <p className="text-sm text-slate-500">Listagem de colunas identificadas nos métodos.</p>
          </div>
        </div>

        <div className="relative max-w-xs w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar coluna ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Identificação da Coluna</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Modelo / Dimensões</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Produto Associado</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Teste Associado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((col, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-teal-50 p-2 rounded-lg shrink-0">
                          <Database className="w-4 h-4 text-teal-500" />
                        </div>
                        <span className="font-bold text-slate-800 leading-tight">{col.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-xs font-mono font-bold bg-teal-50 text-teal-700 px-2 py-1 rounded border border-teal-100">
                        {col.model}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-tighter bg-slate-100 px-2 py-1 rounded-md inline-block">
                        {col.productName}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <Info className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span className="line-clamp-1 italic">{col.testName || 'Geral'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
          <LayoutGrid className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Nenhuma coluna encontrada.</p>
          <p className="text-slate-400 text-sm mt-1">Colunas são identificadas automaticamente em métodos cromatográficos.</p>
        </div>
      )}
    </div>
  );
};

export default ChromatographicColumnsView;
