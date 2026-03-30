import React, { useState, useMemo, useEffect } from 'react';
import { AnalysisResult, Language, GlobalSettings, CapacityData, BatchData, PredictionResult } from '../../types';
import { translations } from '../../utils/translations';
import { 
  ClipboardList, Calculator, Package, Clock, TrendingUp, Search, FlaskConical, 
  Cpu, Users, Save, Plus, Calendar as CalendarIcon, AlertTriangle, CheckCircle, 
  Activity, ChevronRight, Edit2, Trash2, ChevronLeft, X 
} from 'lucide-react';
import { isMicrobiology } from '../../utils/calculations';
import { 
  getCapacity, saveCapacity, getBatches, saveBatch, deleteBatch, 
  runPrediction, getCapacitiesInRange 
} from '../../services/planningService';
import { useToast } from '../../context/ToastContext';

interface PlanningViewProps {
  results: AnalysisResult[];
  language: Language;
  settings: GlobalSettings;
  token?: string;
}

type TabType = 'tactical' | 'capacity' | 'backlog' | 'prediction';

export const PlanningView: React.FC<PlanningViewProps> = ({ results, language, settings, token }) => {
  const [activeTab, setActiveTab] = useState<TabType>('tactical');
  const t = translations[language];
  const { showToast } = useToast();

  // Tactical State
  const [searchTerm, setSearchTerm] = useState('');
  const [batchCounts, setBatchCounts] = useState<Record<string, number>>({});
  const [campaigns, setCampaigns] = useState<Record<string, boolean>>({});

  // Capacity / Calendar State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [monthlyCapacities, setMonthlyCapacities] = useState<Record<string, CapacityData>>({});
  const [capForm, setCapForm] = useState<CapacityData>({ date: '', analystsFQ: 8, analystsMicro: 8, equipmentStatus: 'ok' });
  const [isSavingCap, setIsSavingCap] = useState(false);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);

  // Backlog State
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [backlogSearchTerm, setBacklogSearchTerm] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<Partial<BatchData>>({
    priority: 3,
    entryDate: new Date().toISOString().split('T')[0],
    limitDate: new Date().toISOString().split('T')[0],
    status: 'pending'
  });

  // Prediction State
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [isLoadingPreds, setIsLoadingPreds] = useState(false);

  // --- CALENDAR LOGIC ---

  const fetchMonthlyData = async (date: Date) => {
    setIsLoadingMonthly(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth();
      const start = new Date(year, month, 1).toISOString().split('T')[0];
      const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const data = await getCapacitiesInRange(start, end, token);
      const map: Record<string, CapacityData> = {};
      data.forEach(c => {
        if (c.date) map[c.date] = c;
      });
      setMonthlyCapacities(map);
    } catch (err) {
      console.error("Failed to fetch monthly capacities", err);
    } finally {
      setIsLoadingMonthly(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'capacity') {
      fetchMonthlyData(viewDate);
    }
  }, [viewDate, activeTab, token]);

  // Load selected date detail into form
  useEffect(() => {
    if (monthlyCapacities[selectedDate]) {
      setCapForm(monthlyCapacities[selectedDate]);
    } else {
      setCapForm({ date: selectedDate, analystsFQ: 8, analystsMicro: 8, equipmentStatus: 'ok' });
    }
  }, [selectedDate, monthlyCapacities]);

  const changeMonth = (offset: number) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(next);
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const prevMonthDays = new Date(year, month, 0).getDate();
    const days = [];
    
    // Previous month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const dateStr = new Date(year, month - 1, d).toISOString().split('T')[0];
      days.push({ day: d, dateStr, isCurrentMonth: false });
    }
    
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(year, month, i).toISOString().split('T')[0];
      days.push({ day: i, dateStr, isCurrentMonth: true });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        const dateStr = new Date(year, month + 1, i).toISOString().split('T')[0];
        days.push({ day: i, dateStr, isCurrentMonth: false });
    }
    
    return days;
  }, [viewDate]);

  // Tactical Tab Logic (Restored)
  const filteredResults = useMemo(() => {
    let list = results;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = results.filter(r => r.product.productName.toLowerCase().includes(term) || r.fileName.toLowerCase().includes(term));
    }
    return list;
  }, [results, searchTerm]);

  const totals = useMemo(() => {
    let fq = 0; let micro = 0;
    results.forEach(res => {
      const batchesCnt = batchCounts[res.fileId] ?? 0;
      const isCampaign = campaigns[res.fileId] ?? false;
      if (batchesCnt === 0) return;

      res.rows.forEach(row => {
        const isM = isMicrobiology(row);
        const rowHH = row.manHours || 0;
        if (isM) {
          micro += rowHH * batchesCnt;
        } else {
          if (!isCampaign) { fq += rowHH * batchesCnt; } 
          else {
            const baseTimeMinutes = (row.t_setup || 0) + (row.t_locomotion || 0);
            const sampleOnlyHH = Math.max(0, rowHH - (baseTimeMinutes / 60));
            fq += rowHH + (sampleOnlyHH * (batchesCnt - 1));
          }
        }
      });
    });

    const calculateAnalysts = (hh: number) => {
      if (hh <= 0) return 0;
      const totalMinutes = hh * 60;
      const availablePerDay = settings.dailyAvailableMinutes * settings.labEfficiency;
      return totalMinutes / (availablePerDay || 1);
    };

    return { 
      fq, 
      micro, 
      total: fq + micro, 
      analystsFQ: calculateAnalysts(fq), 
      analystsMicro: calculateAnalysts(micro),
      analystsTotal: calculateAnalysts(fq + micro)
    };
  }, [results, batchCounts, campaigns, settings]);

  const filteredBatches = useMemo(() => {
     if (!backlogSearchTerm.trim()) return batches;
     const term = backlogSearchTerm.toLowerCase();
     return batches.filter(b => 
        (b.batchNumber || '').toLowerCase().includes(term) || 
        (b.productName || '').toLowerCase().includes(term)
     );
  }, [batches, backlogSearchTerm]);

  const filteredProducts = useMemo(() => {
     if (!productSearchQuery.trim()) return results;
     const term = productSearchQuery.toLowerCase();
     return results.filter(r => 
        (r.product.productName || '').toLowerCase().includes(term) || 
        (r.fileName || '').toLowerCase().includes(term)
     );
  }, [results, productSearchQuery]);

  const groupedPredictions = useMemo(() => {
    const groups: Record<string, PredictionResult[]> = {};
    predictions.forEach(p => {
      const key = p.productName || 'Sem Produto';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [predictions]);

  // --- ACTIONS ---

  const handleSaveCapacity = async () => {
    setIsSavingCap(true);
    try {
      await saveCapacity({ ...capForm, date: selectedDate }, token);
      showToast("Capacidade salva!", "success");
      // Update local state to reflect change in calendar immediately
      setMonthlyCapacities(prev => ({ ...prev, [selectedDate]: { ...capForm, date: selectedDate } }));
    } catch (e) {
      showToast("Erro ao salvar capacidade.", "error");
    } finally {
      setIsSavingCap(false);
    }
  };

  // Other effects for Batches/Predictions
  useEffect(() => {
    if (activeTab === 'backlog' || activeTab === 'prediction') {
      getBatches(token)
        .then(data => setBatches(data || []))
        .catch(err => console.error("Error loading batches", err));
    }
  }, [activeTab, token]);

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch.productId || !currentBatch.batchNumber) {
        showToast("Preencha campos obrigatórios.", "warning");
        return;
    }
    const product = results.find(r => r.fileId === currentBatch.productId || r.product.productName === currentBatch.productId);
    const productName = product ? product.product.productName : currentBatch.productId || '';
    try {
      const saved = await saveBatch({
         ...currentBatch as BatchData,
         productId: product ? product.fileId : (currentBatch.productId || ''),
         productName
      }, token);
      setBatches(prev => {
          const idx = prev.findIndex(p => p.id === saved.id);
          if (idx >= 0) {
              const copy = [...prev]; copy[idx] = saved; return copy;
          }
          return [saved, ...prev];
      });
      showToast("Lote salvo!", "success");
      setIsEditingBatch(false);
      setCurrentBatch({ priority: 3, entryDate: new Date().toISOString().split('T')[0], limitDate: new Date().toISOString().split('T')[0], status: 'pending' });
    } catch (e) { showToast("Erro ao salvar lote.", "error"); }
  };

  const handleDeleteBatch = async (id: string) => {
     if (window.confirm("Deletar este lote?")) {
        try {
            await deleteBatch(id, token);
            setBatches(prev => prev.filter(b => b.id !== id));
            showToast("Deletado.", "success");
        } catch (e) { showToast("Erro.", "error"); }
     }
  };

  const handleRunPrediction = async () => {
      setIsLoadingPreds(true);
      try {
          const result = await runPrediction(settings, token);
          setPredictions(result);
          showToast("Predição calculada!", "success");
      } catch (e) { 
          console.error("[PlanningView] Prediction Engine Error:", e);
          showToast("Erro no motor.", "error"); 
      } finally { 
          setIsLoadingPreds(false); 
      }
  };

  useEffect(() => { if (activeTab === 'prediction') handleRunPrediction(); }, [activeTab]);

  // --- RENDERING ---

  const renderPlanejamentoCarga = () => {
    const hasFQ = results.some(r => r.rows.some(row => !isMicrobiology(row)));
    
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header and Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Planejamento de Carga</h2>
            <p className="text-slate-500 text-sm">Quantifique o esforço total (HH) com base na quantidade de lotes.</p>
          </div>
          <div className="relative w-full md:w-80">
            < Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar no banco de dados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 transition-colors group-hover:bg-teal-100/50">
              <Cpu className="w-6 h-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Esforço FQ</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-black text-slate-900">{totals.fq.toFixed(2)}</p>
                <span className="text-sm font-bold text-slate-400 uppercase">H</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-teal-600/70">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Analistas Necessários:</span>
                <span className="text-sm font-black">{totals.analystsFQ.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="bg-pink-50 p-4 rounded-2xl border border-pink-100 transition-colors group-hover:bg-pink-100/50">
              <FlaskConical className="w-6 h-6 text-pink-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Esforço Micro</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-black text-slate-900">{totals.micro.toFixed(2)}</p>
                <span className="text-sm font-bold text-slate-400 uppercase">H</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-pink-600/70">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Analistas Necessários:</span>
                <span className="text-sm font-black">{totals.analystsMicro.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 transition-colors group-hover:bg-teal-100/50">
              <TrendingUp className="w-6 h-6 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Geral</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-2xl font-black text-slate-900">{totals.total.toFixed(2)}</p>
                <span className="text-sm font-bold text-slate-400 uppercase">H</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-teal-600/70">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Analistas Necessários:</span>
                <span className="text-sm font-black">{totals.analystsTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tactical Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Método / Produto</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">HH Unitário</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Lotes</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Campanha?</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Esforço Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((res) => {
                  const unitaryHH = (res.rows || []).reduce((acc, r) => acc + (r.manHours || 0), 0);
                  const batchesCnt = batchCounts[res.fileId] ?? 0;
                  const isCampaign = campaigns[res.fileId] ?? false;
                  const isPC = res.rows.some(row => !isMicrobiology(row));
                  
                  let totalRowHH = 0;
                  if (batchesCnt > 0) {
                    res.rows.forEach(row => {
                      const rowHH = row.manHours || 0;
                      if (isMicrobiology(row) || !isCampaign) {
                        totalRowHH += rowHH * batchesCnt;
                      } else {
                        const baseTimeMinutes = (row.t_setup || 0) + (row.t_locomotion || 0);
                        const sampleOnlyHH = Math.max(0, rowHH - (baseTimeMinutes / 60));
                        totalRowHH += rowHH + (sampleOnlyHH * (batchesCnt - 1));
                      }
                    });
                  }
                  
                  return (
                    <tr key={res.fileId} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl transition-colors ${isPC ? 'bg-teal-50 text-teal-400 group-hover:text-teal-600' : 'bg-pink-50 text-pink-400 group-hover:text-pink-600'}`}>
                            {isPC ? <Cpu className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
                          </div>
                          <div className="max-w-md">
                            <p className="text-sm font-bold text-slate-800 line-clamp-1">{res.product.productName}</p>
                            <p className="text-[10px] text-slate-400 font-mono truncate uppercase tracking-tighter">{res.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 rounded-lg border border-slate-100 text-xs font-bold">
                          <Clock className="w-3 h-3" />
                          <span>{unitaryHH.toFixed(2)}h</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <input
                            type="number"
                            min="0"
                            value={batchesCnt}
                            onChange={(e) => setBatchCounts(prev => ({ ...prev, [res.fileId]: parseInt(e.target.value) || 0 }))}
                            className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isPC && (
                          <button 
                            onClick={() => setCampaigns(prev => ({ ...prev, [res.fileId]: !prev[res.fileId] }))}
                            className={`w-10 h-6 rounded-full transition-all relative inline-block align-middle ${isCampaign ? 'bg-teal-500 shadow-md shadow-teal-500/20' : 'bg-slate-200'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isCampaign ? 'left-5' : 'left-1'}`} />
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-transparent shadow-sm text-sm font-black min-w-24 justify-center transition-all ${batchesCnt > 0 ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-slate-50 text-slate-400'}`}>
                          <Calculator className="w-4 h-4" />
                          <span>{totalRowHH.toFixed(2)}h</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredResults.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 font-bold">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      Nenhum resultado encontrado
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

  const renderCapacity = () => {
    const monthName = viewDate.toLocaleString(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-xl font-black text-slate-800 capitalize">{monthName}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all">
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button onClick={() => setViewDate(new Date())} className="px-3 py-1 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-lg transition-all">Hoje</button>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all">
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 border-b border-slate-100">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {calendarDays.map((d, i) => {
              const data = monthlyCapacities[d.dateStr];
              const isSelected = selectedDate === d.dateStr;
              const isWeekend = i % 7 === 0 || i % 7 === 6;
              const hasData = !!data;
              const isToday = d.dateStr === new Date().toISOString().split('T')[0];

              return (
                <button 
                  key={i}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`
                    h-24 p-2 text-left border-r border-b border-slate-50 transition-all group relative
                    ${d.isCurrentMonth ? 'bg-white' : 'bg-slate-50/30 text-slate-300'}
                    ${isSelected ? 'ring-2 ring-inset ring-teal-500 bg-teal-50/20 z-10' : 'hover:bg-slate-50'}
                  `}
                >
                  <span className={`
                    text-xs font-bold 
                    ${isToday ? 'bg-teal-600 text-white w-5 h-5 flex items-center justify-center rounded-full' : ''}
                    ${isWeekend && !isToday ? 'text-red-400' : ''}
                  `}>
                    {d.day}
                  </span>
                  
                  {hasData && d.isCurrentMonth && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>
                        <span className="text-[9px] font-black text-slate-600">FQ: {data.analystsFQ}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-400"></div>
                        <span className="text-[9px] font-black text-slate-600">M: {data.analystsMicro}</span>
                      </div>
                      {data.equipmentStatus === 'maintenance' && (
                        <div className="absolute top-1 right-1">
                           <AlertTriangle className="w-3 h-3 text-red-500" />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!hasData && d.isCurrentMonth && !isWeekend && (
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Plus className="w-3 h-3 text-slate-300" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl self-start sticky top-24">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
               <CalendarIcon className="w-6 h-6 text-teal-600" /> {new Date(selectedDate + 'T12:00:00Z').toLocaleDateString()}
            </h3>
            
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analistas FQ</label>
                        <input 
                          type="number" 
                          value={capForm.analystsFQ} 
                          onChange={(e) => setCapForm({...capForm, analystsFQ: parseFloat(e.target.value) || 0})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-lg text-slate-800 focus:ring-2 focus:ring-teal-500/20"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analistas Micro</label>
                        <input 
                          type="number" 
                          value={capForm.analystsMicro} 
                          onChange={(e) => setCapForm({...capForm, analystsMicro: parseFloat(e.target.value) || 0})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-lg text-slate-800 focus:ring-2 focus:ring-teal-500/20"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipamentos</label>
                    <select 
                      value={capForm.equipmentStatus} 
                      onChange={(e) => setCapForm({...capForm, equipmentStatus: e.target.value as any})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 transition-all"
                    >
                        <option value="ok">Operacional</option>
                        <option value="maintenance">Manutenção Programada</option>
                    </select>
                </div>

                <button 
                  onClick={handleSaveCapacity} 
                  disabled={isSavingCap}
                  className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-black rounded-2xl shadow-lg shadow-teal-600/30 flex justify-center items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                   {isSavingCap ? "Salvando..." : <><Save className="w-5 h-5"/> Salvar para este dia</>}
                </button>
                
                <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest">
                  Selecione um dia no calendário para editar
                </p>
            </div>
        </div>
      </div>
    );
  };

  // Re-use other render methods
  const renderBacklog = () => (
      <div className="space-y-6 animate-fade-in">
          {!isEditingBatch ? (
             <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <div>
                       <h3 className="text-xl font-black text-slate-800">Backlog de Lotes</h3>
                       <p className="text-xs text-slate-500">Regras de prioridade (FIFO + Prioridade Nível)</p>
                   </div>
                   
                   <div className="flex flex-1 flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                      <div className="relative w-full md:max-w-xs flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Buscar no backlog..."
                            value={backlogSearchTerm}
                            onChange={(e) => setBacklogSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                          />
                      </div>
                      
                      <button onClick={() => { setIsEditingBatch(true); setCurrentBatch({ priority: 3, entryDate: new Date().toISOString().split('T')[0], limitDate: new Date().toISOString().split('T')[0], status: 'pending' }); }}
                         className="px-6 py-2 bg-teal-600 text-white rounded-xl font-black text-sm shadow-lg shadow-teal-600/20 hover:bg-teal-500 flex items-center gap-2 whitespace-nowrap transition-all active:scale-95">
                         <Plus className="w-5 h-5"/> Novo Lote
                      </button>
                   </div>
                </div>
                
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                   <table className="w-full text-left">
                       <thead className="bg-slate-50 border-b border-slate-200">
                           <tr>
                               <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase">Lote</th>
                               <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase">Produto</th>
                               <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase text-center">Entrada | Limite</th>
                               <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase text-center w-32">Ações</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {filteredBatches.length === 0 ? (
                               <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold">Nenhum lote programado</td></tr>
                           ) : filteredBatches.map(b => (
                               <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                   <td className="px-4 py-4">
                                       <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                           {b.priority === 1 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Alta Prioridade" />}
                                           {b.priority === 2 && <span className="w-2 h-2 bg-yellow-500 rounded-full" title="Média Prioridade" />}
                                           {b.priority === 3 && <span className="w-2 h-2 bg-slate-300 rounded-full" title="Baixa Prioridade" />}
                                           {b.batchNumber}
                                       </div>
                                       <span className="text-[10px] uppercase font-black text-slate-400 px-2 py-0.5 rounded-md bg-slate-100">{b.status}</span>
                                   </td>
                                   <td className="px-4 py-4 text-sm font-bold text-slate-600">{b.productName}</td>
                                   <td className="px-4 py-4 text-center">
                                       <div className="text-xs font-mono text-slate-500">{new Date(b.entryDate).toLocaleDateString()}</div>
                                       <div className="text-xs font-mono text-red-500 font-bold">{new Date(b.limitDate).toLocaleDateString()}</div>
                                   </td>
                                   <td className="px-4 py-4 w-32 shrink-0">
                                       <div className="flex items-center justify-center gap-2 whitespace-nowrap flex-nowrap">
                                           <button onClick={() => { setCurrentBatch(b); setIsEditingBatch(true); }} className="p-2.5 text-slate-400 hover:text-teal-600 bg-white hover:bg-teal-50 border border-slate-200 rounded-xl transition-all shadow-sm"><Edit2 className="w-4 h-4"/></button>
                                           <button onClick={() => handleDeleteBatch(b.id!)} className="p-2.5 text-red-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 rounded-xl transition-all shadow-sm"><Trash2 className="w-4 h-4"/></button>
                                       </div>
                                   </td>
                               </tr>
                           ))}
                       </tbody>
                   </table>
                </div>
             </>
          ) : (
             <div className="max-w-3xl mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
                 <h3 className="text-xl font-black text-slate-800 mb-6">{currentBatch.id ? 'Editar Lote' : 'Novo Lote'}</h3>
                 <form onSubmit={handleSaveBatch} className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-sm font-bold text-slate-700 block mb-2">Número do Lote <span className="text-red-500">*</span></label>
                             <input type="text" value={currentBatch.batchNumber || ''} onChange={e => setCurrentBatch({...currentBatch, batchNumber: e.target.value})} required className="w-full px-4 py-2 border rounded-xl" />
                         </div>
                         <div>
                             <label className="text-sm font-bold text-slate-700 block mb-2">Produto Teórico <span className="text-red-500">*</span></label>
                             <button
                                type="button"
                                onClick={() => {
                                  setIsProductModalOpen(true);
                                  setProductSearchQuery('');
                                }}
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-left font-medium text-slate-700 hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/10 transition-all flex items-center justify-between"
                             >
                                <span>
                                  {currentBatch.productId 
                                    ? (results.find(r => r.fileId === currentBatch.productId || r.product.productName === currentBatch.productId)?.product.productName || currentBatch.productId)
                                    : "Selecionar produto..."}
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                             </button>
                         </div>
                         <div>
                             <label className="text-sm font-bold text-slate-700 block mb-2">Data Entrada</label>
                             <input type="date" value={currentBatch.entryDate || ''} onChange={e => setCurrentBatch({...currentBatch, entryDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
                         </div>
                         <div>
                             <label className="text-sm font-bold text-slate-700 block mb-2">Data Limite (Prometida)</label>
                             <input type="date" value={currentBatch.limitDate || ''} onChange={e => setCurrentBatch({...currentBatch, limitDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
                         </div>
                         <div>
                             <label className="text-sm font-bold text-slate-700 block mb-2">Prioridade</label>
                             <select value={currentBatch.priority} onChange={e => setCurrentBatch({...currentBatch, priority: parseInt(e.target.value)})} className="w-full px-4 py-2 border rounded-xl">
                                 <option value={1}>Alta (SLA Urgente)</option>
                                 <option value={2}>Média (Amanhã)</option>
                                 <option value={3}>Baixa (Fluxo Normal)</option>
                             </select>
                         </div>
                         <div>
                             <label className="text-sm font-bold text-slate-700 block mb-2">Status</label>
                             <select value={currentBatch.status} onChange={e => setCurrentBatch({...currentBatch, status: e.target.value as any})} className="w-full px-4 py-2 border rounded-xl">
                                 <option value="pending">Aguardando Fila</option>
                                 <option value="running">Em Execução</option>
                                 <option value="completed">Concluído</option>
                             </select>
                         </div>
                     </div>
                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                         <button type="button" onClick={() => setIsEditingBatch(false)} className="px-6 py-2 border rounded-xl font-bold text-slate-600">Cancelar</button>
                         <button type="submit" className="px-6 py-2 bg-teal-600 text-white rounded-xl font-bold shadow-md hover:bg-teal-500">Salvar Lote</button>
                     </div>
                 </form>
             </div>
          )}
      </div>
  );

  const renderPrediction = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl border border-slate-700 text-white">
             <div>
                 <h2 className="text-2xl font-black tracking-tight flex items-center gap-3"><Activity className="w-6 h-6 text-teal-400"/> Motor de Predição (ETD)</h2>
                 <p className="text-slate-400 text-sm mt-1 max-w-lg">O motor cruza o backlog atual priorizado contra a capacidade diária, aplicando o Fator de Variabilidade histórico.</p>
             </div>
             <button onClick={handleRunPrediction} disabled={isLoadingPreds}
                className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 font-black rounded-xl shadow-lg shadow-teal-500/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                {isLoadingPreds ? "Calculando..." : "Rodar Simulação"}
             </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Produto</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lotes (Status ETD)</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status Geral</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedPredictions).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-20 text-center text-slate-400 font-bold">
                      {isLoadingPreds ? "Calculando previsões..." : "Nenhuma predição gerada. Clique em Simular."}
                    </td>
                  </tr>
                ) : Object.entries(groupedPredictions).map(([productName, preds]) => {
                  const worstRisk = preds.some(p => p.riskStatus === 'Vermelho') ? 'Vermelho' : preds.some(p => p.riskStatus === 'Amarelo') ? 'Amarelo' : 'Verde';
                  
                  return (
                    <tr key={productName} className="hover:bg-slate-50 transition-colors group align-top">
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <p className="text-sm font-black text-slate-800 line-clamp-2">{productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mt-1">
                            {preds.length} Lotes no Backlog
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {/* THE "THREE LIST" - batches in a 3-column grid inside table cell */}
                        <div className="grid grid-cols-3 gap-2 min-w-[400px]">
                          {preds.map(pred => {
                            const isRed = pred.riskStatus === 'Vermelho';
                            const isYellow = pred.riskStatus === 'Amarelo';
                            return (
                              <div 
                                key={pred.id} 
                                className={`p-3 rounded-2xl border transition-all hover:shadow-md hover:scale-[1.02] cursor-default bg-white flex flex-col gap-1.5 ${
                                  isRed ? 'border-red-100 bg-red-50/10' : 
                                  isYellow ? 'border-yellow-100 bg-yellow-50/10' : 
                                  'border-slate-100 hover:border-teal-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-slate-800">{pred.batchNumber}</span>
                                  <div className={`w-2 h-2 rounded-full ${isRed ? 'bg-red-500' : isYellow ? 'bg-yellow-400' : 'bg-teal-500'}`} />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-[9px] font-bold text-slate-400">
                                    <span>SLA:</span>
                                    <span>{new Date(pred.limitDate + 'T12:00:00Z').toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex justify-between text-[9px] font-bold">
                                    <span className="text-slate-400">EST:</span>
                                    <span className={isRed ? 'text-red-500' : isYellow ? 'text-yellow-600' : 'text-teal-600'}>
                                      {new Date(pred.predictedDate + 'T12:00:00Z').toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center justify-center p-3 rounded-full ${
                          worstRisk === 'Vermelho' ? 'bg-red-100 text-red-600' : 
                          worstRisk === 'Amarelo' ? 'bg-yellow-100 text-yellow-600' : 'bg-teal-100 text-teal-600'
                        }`}>
                          {worstRisk === 'Vermelho' ? <AlertTriangle className="w-5 h-5" /> : worstRisk === 'Amarelo' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                        </div>
                        <p className={`text-[10px] font-black uppercase tracking-widest mt-2 ${
                          worstRisk === 'Vermelho' ? 'text-red-600' : worstRisk === 'Amarelo' ? 'text-yellow-700' : 'text-teal-700'
                        }`}>
                          {worstRisk}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </div>
  );

  return (
    <div className="w-full">
        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6 pt-2 pb-2">
            {[
               { id: 'tactical', label: 'Planejamento de Carga', icon: Calculator },
               { id: 'prediction', label: 'Previsões ETD', icon: TrendingUp },
               { id: 'backlog', label: 'Gestão de Backlog', icon: Package },
               { id: 'capacity', label: 'Capacidade Operacional', icon: Users },
            ].map(tab => {
               const Icon = tab.icon;
               const isActive = activeTab === tab.id;
               return (
                   <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)}
                       className={`px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all relative ${
                           isActive ? 'bg-white text-teal-600 shadow-md border border-slate-200' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                       }`}>
                       <Icon className={`w-4 h-4 ${isActive ? 'text-teal-500' : 'text-slate-400'}`} /> {tab.label}
                       {isActive && <div className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-8 h-1 bg-teal-500 rounded-full shadow-glow-sm shadow-teal-500/50"></div>}
                   </button>
               );
            })}
        </div>

        <div className="pb-20">
            {activeTab === 'tactical' && renderPlanejamentoCarga()}
            {activeTab === 'capacity' && renderCapacity()}
            {activeTab === 'backlog' && renderBacklog()}
            {activeTab === 'prediction' && renderPrediction()}
        </div>

        {/* Product Selection Modal */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsProductModalOpen(false)}
            />
            
            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800">Selecionar Produto</h3>
                <button 
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Pesquisar por nome ou arquivo..."
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 transition-all font-medium"
                  />
                </div>
                
                <div className="max-height-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar" style={{ maxHeight: '400px' }}>
                  {filteredProducts.map((res) => {
                    const isPC = res.rows.some(row => !isMicrobiology(row));
                    const isSelected = currentBatch.productId === res.fileId;
                    
                    return (
                      <button
                        key={res.fileId}
                        onClick={() => {
                          setCurrentBatch({ ...currentBatch, productId: res.fileId });
                          setIsProductModalOpen(false);
                        }}
                        className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all group ${
                          isSelected 
                            ? 'bg-teal-50 border-teal-200' 
                            : 'bg-white border-slate-100 hover:border-teal-500/30 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl border ${
                          isPC 
                            ? 'bg-teal-50 border-teal-100 text-teal-500 group-hover:bg-teal-100' 
                            : 'bg-pink-50 border-pink-100 text-pink-500 group-hover:bg-pink-100'
                        }`}>
                          {isPC ? <Cpu className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
                        </div>
                        
                        <div className="text-left flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${isSelected ? 'text-teal-700' : 'text-slate-800'}`}>
                            {res.product.productName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono truncate uppercase tracking-tighter">
                            {res.fileName}
                          </p>
                        </div>
                        
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-teal-500 shadow-sm" />
                        )}
                      </button>
                    );
                  })}
                  
                  {filteredProducts.length === 0 && (
                    <div className="py-12 text-center text-slate-400 font-bold">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      Nenhum produto encontrado
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
