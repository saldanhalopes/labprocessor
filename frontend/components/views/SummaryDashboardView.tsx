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

      {/* Middle: Quick Insights / Trends Section (Sumário de Técnicas) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/20">
         <div className="flex items-center justify-between mb-6 px-4">
           <div className="flex items-center gap-2">
             <LayoutGrid className="w-5 h-5 text-teal-600" />
             <h3 className="font-bold text-slate-800 text-base">Carga por Técnica (FQ)</h3>
           </div>
           <div className="flex items-center gap-4">
             <Calendar className="w-4 h-4 text-slate-300" />
             <button 
               onClick={() => onNavigate?.('charts')}
               className="px-4 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black rounded-xl border border-slate-100 hover:bg-slate-100 transition-all flex items-center gap-2"
             >
               <BarChart3 className="w-3.5 h-3.5" />
               Relatório Completo
             </button>
           </div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
           {techniqueStats.length > 0 ? techniqueStats.map(item => (
             <div key={item.label} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 hover:border-teal-100 transition-colors group">
               <div className="flex justify-between text-[10px] font-black mb-2 px-1">
                 <span className="text-slate-500 uppercase tracking-tighter truncate" title={item.label}>{item.label}</span>
                 <span className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md">{item.val}%</span>
               </div>
               <div className="h-1.5 bg-slate-200/50 rounded-full overflow-hidden">
                 <div 
                   className="h-full rounded-full transition-all duration-1000 ease-out group-hover:opacity-80" 
                   style={{ width: `${item.val}%`, backgroundColor: item.color }} 
                 />
               </div>
             </div>
           )) : (
             <div className="col-span-full py-4 text-center text-slate-400 text-xs italic">
               Dados insuficientes para análise.
             </div>
           )}
         </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Bottom: Detailed Comparison Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">Comparativo de Métodos Analíticos</h3>
            </div>
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-teal-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Busca rápida..." 
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-400 transition-all w-48 focus:w-64 shadow-sm" 
              />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden ring-1 ring-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/3">Produto / Código</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Setor (FQ | Micro)</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center w-32">Lead Time</th>
                    <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Insumos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {results.slice(0, 10).map((res, idx) => {
                    return (
                      <tr key={res.fileId} className="hover:bg-slate-50/50 transition-all cursor-default group">
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-5">
                            <div className="bg-slate-100 group-hover:bg-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-slate-400 text-sm shrink-0 shadow-sm border border-slate-200/50 transition-colors">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-base leading-tight">{res.product.productName}</div>
                              <div className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-1">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{res.product.code || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-center">
                          <div className="flex items-center justify-center gap-6">
                            {/* Físico-Químico Info */}
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1.5 text-teal-600 bg-teal-50/50 px-3 py-1.5 rounded-xl mb-1.5 border border-teal-100 shadow-sm">
                                <FlaskConical className="w-3.5 h-3.5" />
                                <span className="text-xs font-black">{(() => {
                                  const rows = res.rows.filter(r => !isMicrobiology(r));
                                  return rows.length > 0 ? Math.max(...rows.map(r => r.totalTimeHours)).toFixed(1) : '0';
                                })()}h</span>
                              </div>
                              <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">FQ</span>
                            </div>
                            
                            <div className="w-px h-8 bg-slate-100"></div>
                            
                            {/* Microbiologia Info */}
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-1.5 text-pink-600 bg-pink-50/50 px-3 py-1.5 rounded-xl mb-1.5 border border-pink-100 shadow-sm">
                                <Bug className="w-3.5 h-3.5" />
                                <span className="text-xs font-black">{(() => {
                                  const rows = res.rows.filter(r => isMicrobiology(r));
                                  return rows.length > 0 ? Math.max(...rows.map(r => r.totalTimeHours)).toFixed(1) : '0';
                                })()}h</span>
                              </div>
                              <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">MICRO</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="text-base font-black text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                              {calculateParallelLeadTime(res.rows).toFixed(1)}h
                            </span>
                            <div className="mt-2.5 w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${Math.min(100, (calculateParallelLeadTime(res.rows) / 24) * 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-center">
                          <div className="flex justify-center gap-4">
                            {/* Reagents Badge */}
                            <div className="relative group/icon flex items-center justify-center">
                              <FlaskConical className={`w-4.5 h-4.5 transition-colors ${res.reagents?.length ? 'text-teal-600' : 'text-slate-200'}`} />
                              {res.reagents?.length > 0 && (
                                <span className="absolute -top-1.5 -right-2 bg-teal-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border-[1.5px] border-white shadow-sm scale-110">
                                  {res.reagents.length}
                                </span>
                              )}
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 invisible group-hover/icon:opacity-100 group-hover/icon:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700">
                                Reagentes
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>
                            
                            {/* Standards Badge */}
                            <div className="relative group/icon flex items-center justify-center">
                              <ScrollText className={`w-4.5 h-4.5 transition-colors ${res.standards?.length ? 'text-indigo-600' : 'text-slate-200'}`} />
                              {res.standards?.length > 0 && (
                                <span className="absolute -top-1.5 -right-2 bg-indigo-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border-[1.5px] border-white shadow-sm scale-110">
                                  {res.standards.length}
                                </span>
                              )}
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 invisible group-hover/icon:opacity-100 group-hover/icon:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700">
                                Padrões
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>

                            {/* Equipments Badge */}
                            <div className="relative group/icon flex items-center justify-center">
                              <PlusSquare className={`w-4.5 h-4.5 transition-colors ${(res.equipments?.length) ? 'text-orange-600' : 'text-slate-200'}`} />
                              {(res.equipments?.length || 0) > 0 && (
                                <span className="absolute -top-1.5 -right-2 bg-orange-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border-[1.5px] border-white shadow-sm scale-110">
                                  {res.equipments.length}
                                </span>
                              )}
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 invisible group-hover/icon:opacity-100 group-hover/icon:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700">
                                Equipamentos
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>
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
      </div>




    </div>
  );
};
