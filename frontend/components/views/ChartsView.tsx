import React, { useState, useMemo } from 'react';
import { AnalysisResult } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { Filter, BarChart4, Clock, FlaskConical, Bug } from 'lucide-react';
import { isMicrobiology } from '../../utils/calculations';

const normalizeTechnique = (tech: string): string => {
  const t = tech.toLowerCase().trim();
  
  if (t.includes('hplc') || t.includes('cromatogra')) return 'Cromatografia (HPLC)';
  if (t.includes('dissol') || t.includes('disol')) return 'Dissolução';
  if (t.includes('espectro') || t.includes(' uv')) return 'Espectroscopia (UV)';
  if (t.includes('microbiol') || t.includes('biol') || t.includes('61') || t.includes('62')) return 'Microbiologia';
  if (t.includes('gravimetr')) return 'Gravimetria';
  if (t.includes('titula')) return 'Titulação';
  if (t.includes('viscos')) return 'Viscosidade';
  if (t.includes('balança') || t.includes('balance') || t.includes('termobal')) return 'Balança/Termobalança';
  if (t.includes('exame') || t.includes('ensayo') || t.includes('test')) return 'Ensaios/Exames';
  if (t.includes('calcul') || t.includes('cálcul')) return 'Cálculos';
  
  // Return capitalize first letter of original if no match
  return tech.charAt(0).toUpperCase() + tech.slice(1);
};

interface ChartsViewProps {
  results: AnalysisResult[];
}

export const ChartsView: React.FC<ChartsViewProps> = ({ results }) => {
  const [selectedProductIndex, setSelectedProductIndex] = useState<number>(0);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'phys' | 'micro'>('all');
  const [breakdownFilter, setBreakdownFilter] = useState<'all' | 'phys' | 'micro'>('all');
  const [techFilter, setTechFilter] = useState<'all' | 'phys' | 'micro'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // --- Data Preparation ---

  // 1. Time Breakdown (Grouped Bars for categories)
  const breakdownData = useMemo(() => {
    const data: any[] = [];
    
    results.forEach(res => {
      // PhysChem Totals
      let p_prep = 0, p_run = 0, p_calc = 0, p_others = 0;
      // Micro Totals
      let m_prep = 0, m_run = 0, m_calc = 0, m_incub = 0, m_others = 0;

      res.rows.forEach(row => {
        const isMicro = isMicrobiology(row);
        if (isMicro) {
          m_prep += row.t_prep;
          m_run += row.t_run;
          m_calc += row.t_calc;
          m_incub += (row.t_incubation || 0);
          m_others += (row.t_locomotion + row.t_setup + row.t_register + row.t_analysis);
        } else {
          p_prep += row.t_prep;
          p_run += row.t_run;
          p_calc += row.t_calc;
          p_others += (row.t_locomotion + row.t_setup + row.t_register + row.t_analysis);
        }
      });

      const productName = res.product.productName.length > 15 ? res.product.productName.substring(0, 15) + '...' : res.product.productName;

      // Add two entries per product for grouped bar effect, filtered by breakdownFilter
      if (breakdownFilter === 'all' || breakdownFilter === 'phys') {
        data.push({
          name: productName,
          group: `${productName} (FQ)`,
          category: 'Físico-Química',
          Prep: p_prep / 60,
          Run: p_run / 60,
          Calc: p_calc / 60,
          Incub: 0,
          Outros: p_others / 60,
          isMicro: false
        });
      }

      if (breakdownFilter === 'all' || breakdownFilter === 'micro') {
        data.push({
          name: productName,
          group: `${productName} (MB)`,
          category: 'Microbiologia',
          Prep: m_prep / 60,
          Run: m_run / 60,
          Calc: m_calc / 60,
          Incub: m_incub / 60,
          Outros: m_others / 60,
          isMicro: true
        });
      }
    });
    
    return data;
  }, [results, breakdownFilter]);

  // 2. Gantt / Timeline Data for Selected Product
  const ganttData = useMemo(() => {
    if (!results[selectedProductIndex]) return [];
    let rows = results[selectedProductIndex].rows;
    
    // Apply Category Filter
    if (categoryFilter === 'phys') {
      rows = rows.filter(r => !isMicrobiology(r));
    } else if (categoryFilter === 'micro') {
      rows = rows.filter(r => isMicrobiology(r));
    }
    
    return [...rows]
      .sort((a, b) => b.totalTimeHours - a.totalTimeHours)
      .map(row => ({
        name: row.testName.length > 25 ? row.testName.substring(0, 25) + '...' : row.testName,
        fullName: row.testName,
        duration: row.totalTimeHours,
        technique: row.technique,
        isMicro: isMicrobiology(row),
        breakdown: {
          prep: row.t_prep / 60,
          run: row.t_run / 60,
          calc: row.t_calc / 60,
          incub: (row.t_incubation || 0) / 60
        }
      }));
  }, [results, selectedProductIndex, categoryFilter]);
  
  // 3. Technique Distribution (Overall)
  const techniqueData = useMemo(() => {
    const techMap: Record<string, number> = {};
    results.forEach(res => {
      res.rows.forEach(row => {
        const isMicro = isMicrobiology(row);
        if (techFilter === 'phys' && isMicro) return;
        if (techFilter === 'micro' && !isMicro) return;
        
        const rawTech = row.technique || 'Outras';
        const tech = normalizeTechnique(rawTech);
        
        // Search Filter
        if (searchTerm && !tech.toLowerCase().includes(searchTerm.toLowerCase())) return;

        techMap[tech] = (techMap[tech] || 0) + row.totalTimeHours;
      });
    });
    
    return Object.entries(techMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [results, techFilter, searchTerm]);

  const STACK_COLORS = {
    Prep: '#f59e0b', // Amber
    Run: '#0d9488',  // Teal
    Calc: '#6366f1', // Indigo
    Incub: '#ec4899', // Pink
    Outros: '#94a3b8' // Slate
  };

  if (results.length === 0) {
    return <div className="text-center py-12 text-slate-500">Sem dados para gráficos.</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* Row 1: Technique Distribution (Moved to Top) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold text-slate-800">Carga Horária Total por Técnica</h3>
            </div>
            <p className="text-xs text-slate-400">Distribuição consolidada de horas por método analítico</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Filter */}
            <div className="relative group">
              <input 
                type="text"
                placeholder="Buscar técnica..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit">
              <button 
                onClick={() => setTechFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${techFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setTechFilter('phys')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${techFilter === 'phys' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FlaskConical className="w-3 h-3" /> FQ
              </button>
              <button 
                onClick={() => setTechFilter('micro')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${techFilter === 'micro' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Bug className="w-3 h-3" /> Micro
              </button>
            </div>
          </div>
        </div>
        
        <div className="h-[800px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={techniqueData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} unit=" h" />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={120} 
                tick={{ fontSize: 11, fontWeight: 'bold', fill: '#475569' }} 
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(val: number) => [val.toFixed(1) + ' horas', 'Carga Total']}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                {techniqueData.map((entry, index) => (
                  <Cell 
                    key={`tech-cell-${index}`} 
                    fill={[
                      '#0d9488', // HPLC (Teal)
                      '#6366f1', // Dissolution (Indigo)
                      '#f59e0b', // Spectro (Amber)
                      '#ec4899', // Micro (Pink)
                      '#8b5cf6'  // Others (Violet)
                    ][index % 5]} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Gantt / Timeline */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-slate-800">Cronograma de Ensaios (Gantt)</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button 
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${categoryFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setCategoryFilter('phys')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${categoryFilter === 'phys' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FlaskConical className="w-3 h-3" /> FQ
              </button>
              <button 
                onClick={() => setCategoryFilter('micro')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${categoryFilter === 'micro' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Bug className="w-3 h-3" /> Micro
              </button>
            </div>

            {/* Product Selector */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                value={selectedProductIndex}
                onChange={(e) => setSelectedProductIndex(Number(e.target.value))}
                className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                {results.map((res, idx) => (
                  <option key={res.fileId} value={idx}>
                    {res.product.productName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="h-[500px] w-full">
          {ganttData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={ganttData}
                margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} unit=" h" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={150} 
                  tick={{ fontSize: 11, fill: '#475569' }} 
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9', opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm min-w-[200px]">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-bold text-slate-800">{data.fullName}</p>
                            {data.isMicro ? <Bug className="w-3.5 h-3.5 text-pink-500" /> : <FlaskConical className="w-3.5 h-3.5 text-teal-500" />}
                          </div>
                          <p className="text-slate-500 mb-2 italic text-xs">{data.technique}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between gap-4">
                              <span className="text-amber-600 text-xs font-bold uppercase">Preparo:</span>
                              <span className="font-mono">{data.breakdown.prep.toFixed(2)} h</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-teal-600 text-xs font-bold uppercase">Corrida:</span>
                              <span className="font-mono">{data.breakdown.run.toFixed(2)} h</span>
                            </div>
                            {data.isMicro && (
                              <div className="flex justify-between gap-4">
                                <span className="text-pink-600 text-xs font-bold uppercase">Incubação:</span>
                                <span className="font-mono">{data.breakdown.incub.toFixed(2)} h</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4">
                              <span className="text-indigo-600 text-xs font-bold uppercase">Cálculos:</span>
                              <span className="font-mono">{data.breakdown.calc.toFixed(2)} h</span>
                            </div>
                            <div className="border-t border-slate-100 pt-1 mt-1 flex justify-between gap-4 font-black text-slate-900 border-t-2">
                              <span>TOTAL:</span>
                              <span>{data.duration.toFixed(2)} h</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="duration" radius={[0, 4, 4, 0]} barSize={20}>
                  {ganttData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isMicro ? '#ec4899' : '#0d9488'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              Nenhum dado encontrado para esta categoria.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
