import React, { useState } from 'react';
import { AnalysisResult } from '../../types';
import { Search, FlaskConical, FileText, Filter, ChevronDown, ChevronRight, Package, Cpu, Info } from 'lucide-react';

interface ReagentsViewProps {
  results: AnalysisResult[];
  forceMode?: 'materials' | 'equipments';
}

export const ReagentsView: React.FC<ReagentsViewProps> = ({ results, forceMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'materials' | 'equipments'>(forceMode || 'materials');

  // Update viewMode if forceMode changes
  React.useEffect(() => {
    if (forceMode) setViewMode(forceMode);
  }, [forceMode]);

  // Flatten and group data based on viewMode
  const groupedData: any = {};
  
  results.forEach(res => {
    const key = `${res.product.productName}-${res.fileName}`;
    
    if (viewMode === 'materials') {
      const reagents = res.reagents || [];
      const filtered = reagents.filter(r => {
        const matchesSearch = 
          r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          res.product?.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (r.testName && r.testName.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === 'Todos' || r.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      if (filtered.length > 0) {
        groupedData[key] = {
          productName: res.product.productName,
          fileName: res.fileName,
          items: filtered
        };
      }
    } else {
      const equipments = res.equipments || [];
      const filtered = equipments.filter(e => {
        const matchesSearch = 
          e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          res.product?.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (e.testName && e.testName.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === 'Todos' || e.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });

      if (filtered.length > 0) {
        groupedData[key] = {
          productName: res.product.productName,
          fileName: res.fileName,
          items: filtered
        };
      }
    }
  });

  const groupKeys = Object.keys(groupedData);
  const totalFound = Object.values(groupedData).reduce((acc: number, curr: any) => acc + curr.items.length, 0);

  // Get unique categories for filter
  const allItemsFlat: any[] = viewMode === 'materials' 
    ? results.flatMap(r => r.reagents || []) 
    : results.flatMap(r => r.equipments || []);
  const categories: string[] = ['Todos', ...Array.from(new Set(allItemsFlat.map((r: any) => r.category || 'Geral'))).map(c => String(c)).sort()];

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    groupKeys.forEach(k => allExpanded[k] = true);
    setExpandedGroups(allExpanded);
  };

  const collapseAll = () => setExpandedGroups({});

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Nenhum dado disponível. Carregue arquivos na aba "Carregar".</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {!forceMode && (
        <div className="flex justify-center">
          <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex gap-1">
            <button 
              onClick={() => { setViewMode('materials'); setSelectedCategory('Todos'); }}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'materials' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FlaskConical className="w-4 h-4" /> Reagentes e Materiais
            </button>
            <button 
              onClick={() => { setViewMode('equipments'); setSelectedCategory('Todos'); }}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'equipments' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Cpu className="w-4 h-4" /> Equipamentos
            </button>
          </div>
        </div>
      )}

      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 text-slate-700 font-bold">
          <div className="p-2 bg-teal-50 rounded-lg">
            {viewMode === 'materials' ? <FlaskConical className="w-6 h-6 text-teal-600" /> : <Cpu className="w-6 h-6 text-teal-600" />}
          </div>
          <div>
            <h2 className="text-lg">{viewMode === 'materials' ? 'Reagentes e Materiais' : 'Equipamentos e Instrumentos'}</h2>
            <p className="text-xs text-slate-500 font-normal">Total de {totalFound} itens encontrados</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 mr-2 border-r border-slate-200 pr-4">
            <button onClick={expandAll} className="text-xs text-teal-600 hover:text-teal-700 font-medium px-2 py-1 hover:bg-teal-50 rounded">Expandir</button>
            <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-600 font-medium px-2 py-1 hover:bg-slate-50 rounded">Recolher</button>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none cursor-pointer appearance-none transition-all"
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grouped Content */}
      <div className="space-y-4">
        {groupKeys.length > 0 ? (
          groupKeys.map((key) => {
            const group = groupedData[key];
            const isExpanded = expandedGroups[key];

            return (
              <div key={key} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300">
                <button 
                  onClick={() => toggleGroup(key)}
                  className={`w-full flex items-center justify-between px-6 py-4 text-left transition-colors ${isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 uppercase tracking-tight">{group.productName}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Arquivo: {group.fileName}</span>
                        <span className="mx-1">•</span>
                        <span>{group.items.length} itens</span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="overflow-x-auto animate-slide-down">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-100">
                        {viewMode === 'materials' ? (
                          <tr>
                            <th className="px-8 py-3 w-1/3">Nome do Reagente / Material</th>
                            <th className="px-6 py-3">Concentração / Pureza</th>
                            <th className="px-6 py-3">Quantidade</th>
                            <th className="px-6 py-3">Categoria</th>
                            <th className="px-6 py-3">Teste Associado</th>
                          </tr>
                        ) : (
                          <tr>
                            <th className="px-8 py-3 w-1/3">Equipamento / Instrumento</th>
                            <th className="px-6 py-3">Modelo / Especificação</th>
                            <th className="px-6 py-3">Categoria</th>
                            <th className="px-6 py-3">Teste Associado</th>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {group.items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-4">
                              <span className="font-semibold text-slate-700 group-hover:text-teal-700 transition-colors">
                                {item.name}
                              </span>
                            </td>
                            {viewMode === 'materials' ? (
                              <>
                                <td className="px-6 py-4 text-slate-600 font-mono text-xs">{item.concentration}</td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-md font-bold text-xs ring-1 ring-inset ring-teal-600/10">{item.quantity}</span>
                                </td>
                              </>
                            ) : (
                              <td className="px-6 py-4 text-slate-600 font-mono text-xs italic">{item.model || '-'}</td>
                            )}
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${item.category === 'Cromatógrafo' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {item.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-normal italic text-xs">
                              {item.testName || 'Geral'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center text-slate-400">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm">Nenhum item encontrado com os filtros aplicados.</p>
          </div>
        )}
      </div>
    </div>
  );
};
