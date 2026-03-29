import React, { useState, useMemo } from 'react';
import { AnalysisResult, Language, GlobalSettings } from '../../types';
import { translations } from '../../utils/translations';
import { ClipboardList, Calculator, Package, Clock, TrendingUp, Search, FlaskConical, Cpu, Users } from 'lucide-react';
import { isMicrobiology } from '../../utils/calculations';

interface PlanningViewProps {
  results: AnalysisResult[];
  language: Language;
  settings: GlobalSettings;
}

export const PlanningView: React.FC<PlanningViewProps> = ({ results, language, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [batchCounts, setBatchCounts] = useState<Record<string, number>>({});
  const [campaigns, setCampaigns] = useState<Record<string, boolean>>({});
  const t = translations[language];

  const filteredResults = useMemo(() => {
    let list = results;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = results.filter(r => 
        r.product.productName.toLowerCase().includes(term) || 
        r.fileName.toLowerCase().includes(term)
      );
    }
    return list;
  }, [results, searchTerm]);

  const handleBatchChange = (fileId: string, count: string) => {
    const num = Math.max(0, parseInt(count) || 0);
    setBatchCounts(prev => ({ ...prev, [fileId]: num }));
  };

  const toggleCampaign = (fileId: string) => {
    setCampaigns(prev => ({ ...prev, [fileId]: !prev[fileId] }));
  };

  // Complex calculation logic for segregated totals
  const totals = useMemo(() => {
    let fq = 0;
    let micro = 0;

    results.forEach(res => {
      const batches = batchCounts[res.fileId] ?? 0;
      const isCampaign = campaigns[res.fileId] ?? false;
      
      if (batches === 0) return;

      res.rows.forEach(row => {
        const isM = isMicrobiology(row);
        const rowHH = row.manHours || 0;

        if (isM) {
          micro += rowHH * batches;
        } else {
          if (!isCampaign) {
            fq += rowHH * batches;
          } else {
            // Campaign Logic: 1st batch full, others sample-only
            const baseTimeMinutes = (row.t_setup || 0) + (row.t_locomotion || 0);
            const sampleOnlyHH = Math.max(0, rowHH - (baseTimeMinutes / 60));
            fq += rowHH + (sampleOnlyHH * (batches - 1));
          }
        }
      });
    });

    const calculateAnalysts = (hh: number) => {
      if (hh <= 0) return 0;
      const totalMinutes = hh * 60;
      const availablePerDay = settings.dailyAvailableMinutes * settings.labEfficiency;
      return totalMinutes / (availablePerDay || 1); // Avoid division by zero
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

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
        <ClipboardList className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-xl font-bold text-slate-400 font-display">
          {t.planning.emptyTitle}
        </h3>
        <p className="text-slate-400 text-sm mt-1">
          {t.planning.emptySubtitle}
        </p>
      </div>
    );
  }

  const hasFQ = results.some(r => r.rows.some(row => !isMicrobiology(row)));

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.planning.title}</h3>
          <p className="text-slate-500 text-sm">{t.planning.subtitle}</p>
        </div>
        
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t.results.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100 transition-colors group-hover:bg-teal-100/50">
            <Cpu className="w-6 h-6 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{t.planning.effortFQ}</p>
            <p className="text-2xl font-black text-slate-900">{totals.fq.toFixed(2)} <span className="text-sm font-bold text-slate-400">{t.charts.unitH.toUpperCase()}</span></p>
            <div className="mt-2 flex items-center gap-1.5 text-teal-600/70">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.planning.analysts}:</span>
              <span className="text-sm font-black">{totals.analystsFQ.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="bg-pink-50 p-3 rounded-2xl border border-pink-100 transition-colors group-hover:bg-pink-100/50">
            <FlaskConical className="w-6 h-6 text-pink-600" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{t.planning.effortMicro}</p>
            <p className="text-2xl font-black text-slate-900">{totals.micro.toFixed(2)} <span className="text-sm font-bold text-slate-400">{t.charts.unitH.toUpperCase()}</span></p>
            <div className="mt-2 flex items-center gap-1.5 text-pink-600/70">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.planning.analysts}:</span>
              <span className="text-sm font-black">{totals.analystsMicro.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="bg-teal-50 p-3 rounded-2xl border border-teal-100 transition-colors group-hover:bg-teal-100/50">
            <TrendingUp className="w-6 h-6 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{t.planning.totalGrand}</p>
            <p className="text-2xl font-black text-slate-900">{totals.total.toFixed(2)} <span className="text-sm font-bold text-slate-400">{t.charts.unitH.toUpperCase()}</span></p>
            <div className="mt-2 flex items-center gap-1.5 text-teal-600/70">
              <Users className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.planning.analysts}:</span>
              <span className="text-sm font-black">{totals.analystsTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.planning.table.method}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">{t.planning.table.baseHH}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">{t.planning.table.batches}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                  {hasFQ && t.planning.campaign}
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">{t.planning.table.totalHH}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.map((res) => {
                const unitaryHH = res.rows.reduce((acc, r) => acc + (r.manHours || 0), 0);
                const batches = batchCounts[res.fileId] ?? 0;
                const isCampaign = campaigns[res.fileId] ?? false;
                const isFQ = res.rows.some(row => !isMicrobiology(row));
                
                let totalRowHH = 0;
                if (batches > 0) {
                  res.rows.forEach(row => {
                    const rowHH = row.manHours || 0;
                    if (isMicrobiology(row) || !isCampaign) {
                      totalRowHH += rowHH * batches;
                    } else {
                      const baseTimeMinutes = (row.t_setup || 0) + (row.t_locomotion || 0);
                      const sampleOnlyHH = Math.max(0, rowHH - (baseTimeMinutes / 60));
                      totalRowHH += rowHH + (sampleOnlyHH * (batches - 1));
                    }
                  });
                }
                
                return (
                  <tr key={res.fileId} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${isFQ ? 'bg-teal-50 text-teal-400 group-hover:text-teal-600' : 'bg-pink-50 text-pink-400 group-hover:text-pink-600'}`}>
                          {isFQ ? <Cpu className="w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
                        </div>
                        <div className="max-w-md">
                          <p className="text-sm font-bold text-slate-800 line-clamp-1">{res.product.productName}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{res.fileName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-600 rounded-lg border border-slate-100 text-xs font-bold">
                        <Clock className="w-3 h-3" />
                        <span>{unitaryHH.toFixed(2)}{t.results.unitH}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min="0"
                          value={batches}
                          onChange={(e) => handleBatchChange(res.fileId, e.target.value)}
                          className="w-20 px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isFQ && (
                        <button 
                          onClick={() => toggleCampaign(res.fileId)}
                          className={`w-10 h-6 rounded-full transition-all relative ${isCampaign ? 'bg-teal-500 shadow-lg shadow-teal-500/30' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isCampaign ? 'left-5' : 'left-1'}`} />
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border shadow-sm text-sm font-black min-w-24 justify-center transition-all ${batches > 0 ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                        <Calculator className="w-4 h-4" />
                        <span>{totalRowHH.toFixed(2)}{t.results.unitH}</span>
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
  );
};
