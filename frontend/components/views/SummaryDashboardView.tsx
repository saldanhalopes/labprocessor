import React, { useMemo } from 'react';
import { AnalysisResult, GlobalSettings } from '../../types';
import { 
  PlusSquare, 
  Clock, 
  BarChart3, 
  FlaskConical, 
  Zap, 
  Layers, 
  ArrowUpRight, 
  Search,
  CheckCircle2,
  Calendar,
  LayoutGrid,
  Bug,
  ScrollText,
  UserCircle
} from 'lucide-react';
import { 
  calculateParallelLeadTime, 
  isMicrobiology, 
  calculateTotalManHours, 
  calculateStaffRequired 
} from '../../utils/calculations';

const normalizeTechnique = (tech: string): string => {
  const t = tech.toLowerCase().trim();
  
  if (t.includes('hplc') || t.includes('cromatogra')) return 'HPLC';
  if (t.includes('dissol') || t.includes('disol')) return 'Dissolução';
  if (t.includes('espectro') || t.includes(' uv')) return 'Espectroscopia';
  if (t.includes('microbiol') || t.includes('biol') || t.includes('61') || t.includes('62')) return 'Microbiologia';
  if (t.includes('gravimetr')) return 'Gravimetria';
  if (t.includes('titula')) return 'Titulação';
  if (t.includes('viscos')) return 'Viscosidade';
  if (t.includes('balança') || t.includes('balance') || t.includes('termobal')) return 'Balança/Term';
  if (t.includes('exame') || t.includes('ensayo') || t.includes('test')) return 'Ensaios';
  if (t.includes('calcul') || t.includes('cálcul')) return 'Cálculos';
  
  return tech.charAt(0).toUpperCase() + tech.slice(1);
};
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface SummaryDashboardViewProps {
  results: AnalysisResult[];
  settings: GlobalSettings;
  onNavigate?: (tab: any) => void;
  isLoading?: boolean;
  token?: string | null;
}

export const SummaryDashboardView: React.FC<SummaryDashboardViewProps> = ({ results, settings, onNavigate, isLoading, token }) => {
  // --- Metrificação Global ---
  const stats = useMemo(() => {
    if (results.length === 0) return null;

    const totalMethods = results.length;
    let totalLeadTimeFQ = 0;
    let totalLeadTimeMicro = 0;
    let countFQ = 0;
    let countMicro = 0;
    let totalReagents = 0;
    let totalColumns = 0;
    let totalStandards = 0;

    results.forEach(res => {
      const physChemRows = (res.rows || []).filter(r => !isMicrobiology(r));
      const microRows = (res.rows || []).filter(r => isMicrobiology(r));
      
      if (physChemRows.length > 0) {
        totalLeadTimeFQ += Math.max(...physChemRows.map(r => r.totalTimeHours || 0));
        countFQ++;
      }
      
      if (microRows.length > 0) {
        totalLeadTimeMicro += Math.max(...microRows.map(r => r.totalTimeHours || 0));
        countMicro++;
      }
      
      totalReagents += (res.reagents?.length || 0);
      totalStandards += (res.standards?.length || 0);
      
      const colCount = res.equipments?.filter(e => 
        e.name?.toLowerCase().match(/coluna|column|columna/) || 
        e.category?.toLowerCase().includes('coluna')
      ).length || 0;
      totalColumns += colCount;
    });

    const totalManHours = results.reduce((acc, res) => acc + calculateTotalManHours(res.rows || []), 0);
    const staffRequired = calculateStaffRequired(totalManHours, settings);

    return {
      totalMethods,
      avgLeadTimeFQ: countFQ > 0 ? (totalLeadTimeFQ / countFQ).toFixed(1) : '0',
      avgLeadTimeMicro: countMicro > 0 ? (totalLeadTimeMicro / countMicro).toFixed(1) : '0',
      totalReagents,
      totalStandards,
      totalColumns,
      totalManHours: totalManHours.toFixed(1),
      staffRequired: staffRequired.toFixed(1)
    };
  }, [results]);

  // --- Técnica Distribution ---
  const techniqueStats = useMemo(() => {
    const techMap: Record<string, number> = {};
    let grandTotalHours = 0;

    results.forEach(res => {
      (res.rows || []).forEach(row => {
        if (isMicrobiology(row)) return; // Excluir Micro
        const tech = normalizeTechnique(row.technique || 'Outras');
        techMap[tech] = (techMap[tech] || 0) + (row.totalTimeHours || 0);
        grandTotalHours += (row.totalTimeHours || 0);
      });
    });

    if (grandTotalHours === 0) return [];

    const colors = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];
    
    return Object.entries(techMap)
      .map(([label, total], idx) => ({
        label,
        val: Math.round((total / grandTotalHours) * 100),
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 5); // Show top 5
  }, [results]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 animate-fade-in bg-white rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-teal-500 animate-pulse" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mt-6 font-display">Carregando métricas</h2>
        <p className="text-slate-400 mt-2">Sincronizando dados analíticos...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300 animate-fade-in">
        <Layers className="w-16 h-16 text-slate-200 mb-4" />
        <h2 className="text-xl font-bold text-slate-400 font-display">Nenhum dado consolidado</h2>
        <p className="text-slate-400 max-w-xs text-center mt-2">
          Carregue métodos analíticos para visualizar o painel de métricas avançadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* Total Methods */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <PlusSquare className="w-20 h-20 text-teal-600" />
          </div>
          <div className="relative z-10">
            <div className="bg-teal-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-teal-600 ring-1 ring-teal-100 shadow-inner">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Monografias</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-slate-800">{stats?.totalMethods}</h3>
              <span className="text-xs font-bold text-teal-500 bg-teal-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Processados
              </span>
            </div>
          </div>
        </div>

        {/* Avg Lead Time FQ */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden font-display">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FlaskConical className="w-20 h-20 text-teal-600" />
          </div>
          <div className="relative z-10">
            <div className="bg-teal-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-teal-600 ring-1 ring-teal-100 shadow-inner">
              <FlaskConical className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Avg. Lead Time FQ</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-slate-800">{stats?.avgLeadTimeFQ}h</h3>
              <span className="text-[10px] text-teal-500 font-bold bg-teal-50 px-2 py-0.5 rounded-full">Físico-Químico</span>
            </div>
          </div>
        </div>

        {/* Avg Lead Time Micro */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden font-display">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Bug className="w-20 h-20 text-pink-600" />
          </div>
          <div className="relative z-10">
            <div className="bg-pink-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-pink-600 ring-1 ring-pink-100 shadow-inner">
              <Bug className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Avg. Lead Time Micro</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-slate-800">{stats?.avgLeadTimeMicro}h</h3>
              <span className="text-[10px] text-pink-500 font-bold bg-pink-50 px-2 py-0.5 rounded-full">Microbiologia</span>
            </div>
          </div>
        </div>

        {/* Staff Required */}
        <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-indigo-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden font-display ring-1 ring-indigo-50">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-indigo-600">
            <UserCircle className="w-20 h-20" />
          </div>
          <div className="relative z-10">
            <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 ring-1 ring-indigo-100 shadow-inner">
              <UserCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Analistas Necessários</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-3xl font-black text-indigo-700">{stats?.staffRequired}</h3>
              <span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" /> {stats?.totalManHours} HH
              </span>
            </div>
          </div>
        </div>
        {/* Insumos Mapeados */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden font-display">
          <div className="absolute bottom-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FlaskConical className="w-20 h-20 text-orange-600" />
          </div>
          <div className="relative z-10">
            <div className="bg-orange-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-orange-600 ring-1 ring-orange-100 shadow-inner">
              <FlaskConical className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Insumos Mapeados</p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-700">{stats?.totalReagents}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Reag</span>
              </div>
              <div className="flex flex-col border-l border-slate-100 pl-2">
                <span className="text-lg font-bold text-slate-700">{stats?.totalColumns}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Colu</span>
              </div>
              <div className="flex flex-col border-l border-slate-100 pl-2">
                <span className="text-lg font-bold text-slate-700">{stats?.totalStandards}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Padr</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left: Detailed Comparison Table (2 columns wide on XL) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-teal-600" />
              <h3 className="text-lg font-bold text-slate-800">Comparativo de Métodos Analíticos</h3>
            </div>
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-teal-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Busca rápida..." 
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-400 transition-all w-48 focus:w-64" 
              />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/4">Produto / Código</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Setor (FQ | Micro)</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center w-24">Lead Time</th>
                    <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Processados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {results.map((res, idx) => {
                    const workload = res.rows.reduce((sum, row) => sum + row.totalTimeHours, 0);
                    return (
                      <tr key={res.fileId} className="hover:bg-teal-50/20 transition-all cursor-default">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="bg-slate-100 w-10 h-10 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs shrink-0">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 leading-tight">{res.product.productName}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{res.product.code || 'SEM_CODIGO'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-center">
                          <div className="flex items-center justify-center gap-4">
                            {/* Físico-Químico Info */}
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1.5 text-teal-600 bg-teal-50 px-2 py-1 rounded-md mb-1 border border-teal-100">
                                <FlaskConical className="w-3 h-3" />
                                <span className="text-[10px] font-black">{(() => {
                                  const rows = res.rows.filter(r => !isMicrobiology(r));
                                  return rows.length > 0 ? Math.max(...rows.map(r => r.totalTimeHours)).toFixed(1) : '0';
                                })()}h</span>
                              </div>
                              <span className="text-[8px] uppercase font-bold text-slate-400">FQ</span>
                            </div>
                            
                            <div className="text-slate-200 font-light">|</div>
                            
                            {/* Microbiologia Info */}
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1.5 text-pink-600 bg-pink-50 px-2 py-1 rounded-md mb-1 border border-pink-100">
                                <Bug className="w-3 h-3" />
                                <span className="text-[10px] font-black">{(() => {
                                  const rows = res.rows.filter(r => isMicrobiology(r));
                                  return rows.length > 0 ? Math.max(...rows.map(r => r.totalTimeHours)).toFixed(1) : '0';
                                })()}h</span>
                              </div>
                              <span className="text-[8px] uppercase font-bold text-slate-400">MICRO</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 shadow-sm">
                              {calculateParallelLeadTime(res.rows).toFixed(1)}h
                            </span>
                            <div className="mt-1.5 w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="bg-indigo-400 h-full" style={{ width: `${Math.min(100, (calculateParallelLeadTime(res.rows) / 24) * 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-center">
                          <div className="flex justify-center gap-3">
                            <span className={`p-1.5 rounded-lg border ${res.reagents?.length ? 'bg-teal-50 text-teal-600 border-teal-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title={`Reagentes: ${res.reagents?.length || 0}`}>
                              <FlaskConical className="w-3.5 h-3.5" />
                            </span>
                            <span className={`p-1.5 rounded-lg border ${res.standards?.length ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title={`Padrões: ${res.standards?.length || 0}`}>
                              <ScrollText className="w-3.5 h-3.5" />
                            </span>
                            <span className={`p-1.5 rounded-lg border ${(res.equipments?.length) ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`} title={`Equipamentos: ${res.equipments?.length || 0}`}>
                              <PlusSquare className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Quick Insights / Trends Section */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/20">
             <div className="flex items-center justify-between mb-6 px-2">
               <h3 className="font-bold text-slate-800">Carga por Técnica (FQ)</h3>
               <Calendar className="w-4 h-4 text-slate-300" />
             </div>
             <div className="space-y-4">
                {techniqueStats.length > 0 ? techniqueStats.map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs font-bold mb-1.5 px-1">
                      <span className="text-slate-500 uppercase tracking-tighter">{item.label}</span>
                      <span className="text-slate-400">{item.val}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${item.val}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                )) : (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    Dados insuficientes para análise.
                  </div>
                )}
              </div>
             <button 
               onClick={() => onNavigate?.('charts')}
               className="w-full mt-8 py-3 bg-slate-50 text-slate-600 text-sm font-bold rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors"
             >
               Ver Relatório Completo
             </button>
          </div>
        </div>

      </div>
    </div>
  );
};
