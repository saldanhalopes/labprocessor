import React, { useState } from 'react';
import { BarChart3, TrendingUp, Clock, User, Cpu, Loader2, ChevronDown, ChevronUp, Layers, FlaskConical } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { AtividadesTable } from '../AtividadesTable';

function cellColor(celula: string) {
  if (!celula) return '';
  if (celula.includes('SÓLIDOS')) return 'bg-blue-100 text-blue-800';
  if (celula.includes('INJET')) return 'bg-purple-100 text-purple-800';
  if (celula.includes('SUSP') || celula.includes('LIQ')) return 'bg-amber-100 text-amber-800';
  if (celula.includes('HORM')) return 'bg-pink-100 text-pink-800';
  return 'bg-teal-100 text-teal-800';
}

interface MfvcqBadgeProps {
  mfvcq: any;
  productName: string;
}

export const MfvcqBadge: React.FC<MfvcqBadgeProps> = ({ mfvcq, productName }) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Record<number, boolean>>({});
  const [editedAtividades, setEditedAtividades] = useState<Record<number, any[]>>({});

  if (!mfvcq?.matched) return null;

  const handleToggle = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (!analysis) {
      setLoading(true);
      try {
        const res = await apiFetch('/mfvcq/search?q=' + encodeURIComponent(productName));
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const res2 = await fetch('/api/mfvcq/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: data[0].ativo || productName, lotes: 1 })
          });
          const result = await res2.json();
          setAnalysis(result);
        }
      } catch (e) {
        console.error('MFVCQ load error:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="border border-teal-200 rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-2 bg-teal-50 hover:bg-teal-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Dados MFVCQ</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cellColor(mfvcq.celula)}`}>
            {mfvcq.celula}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-teal-600" /> : <ChevronDown className="w-4 h-4 text-teal-600" />}
      </button>

      {expanded && (
        <div className="p-4 bg-white space-y-3">
          {/* Basic MFVCQ Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block">Código PA</span>
              <span className="font-bold text-slate-800">{mfvcq.codigo_pa || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Ativo</span>
              <span className="font-bold text-slate-800">{mfvcq.ativo || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Célula</span>
              <span className={`font-bold ${cellColor(mfvcq.celula)}`}>{mfvcq.celula || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Demanda Média</span>
              <span className="font-bold text-slate-800">
                {mfvcq.demanda_media ? Math.round(mfvcq.demanda_media).toLocaleString() : '-'} und
              </span>
            </div>
          </div>

          {/* Full MFVCQ Analysis */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando fluxo MFVCQ...
            </div>
          )}

          {analysis && analysis.resumo_tempos && (
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Fluxo de CQ ({analysis.analises_cq?.length || 0} testes)
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Clock className="w-3 h-3" /> Fixo (calibração)
                  </div>
                  <p className="text-sm font-bold text-blue-600">{analysis.resumo_tempos.fixo_horas}h</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Layers className="w-3 h-3" /> Var/lote
                  </div>
                  <p className="text-sm font-bold text-indigo-600">{analysis.resumo_tempos.variavel_por_lote_horas}h</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <User className="w-3 h-3" /> MO (analista)
                  </div>
                  <p className="text-sm font-bold text-amber-600">{analysis.resumo_tempos.carga_homem_horas}h</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                    <Cpu className="w-3 h-3" /> MAQ (máquina)
                  </div>
                  <p className="text-sm font-bold text-slate-600">{analysis.resumo_tempos.carga_maquina_horas}h</p>
                </div>
              </div>

              {/* Testes table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left py-1 font-medium">Teste</th>
                      <th className="text-right py-1 font-medium">Fixo</th>
                      <th className="text-right py-1 font-medium">Var</th>
                      <th className="text-right py-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.analises_cq?.slice(0, 10).map((a: any, i: number) => {
                      const hasAtividades = (a.atividades || []).length > 0;
                      const atvs = editedAtividades[i] || a.atividades || [];
                      const getTotals = () => {
                        if (atvs.length === 0) return { f: a.fixo?.total_min||0, v: a.variavel?.total_min||0, t: a.total_compartilhado_min||0 };
                        const fix = atvs.filter((x:any) => x.padrao_amostra==='Padrão');
                        const vr = atvs.filter((x:any) => x.padrao_amostra==='Amostra');
                        const sum = (l:any[]) => l.reduce((s:number,x:any)=>s+(x.tempo_min||0),0);
                        const f = sum(fix); const v = sum(vr);
                        return { f, v, t: Math.round((f+v)*100)/100 };
                      };
                      const tot = getTotals();
                      return (
                        <React.Fragment key={i}>
                          <tr
                            className={`border-b border-slate-50 ${hasAtividades ? 'cursor-pointer hover:bg-indigo-50/30' : ''}`}
                            onClick={() => hasAtividades && setExpandedTests(p => ({ ...p, [i]: !p[i] }))}
                          >
                            <td className="py-1 text-slate-800 font-medium">
                              {a.teste}
                              {hasAtividades && <span className="ml-1 text-[9px] text-indigo-400">({(a.atividades||[]).length})</span>}
                            </td>
                            <td className="py-1 text-right text-blue-600">{tot.f.toFixed(0)}</td>
                            <td className="py-1 text-right text-indigo-600">{tot.v.toFixed(0)}</td>
                            <td className="py-1 text-right text-slate-800 font-bold">{tot.t.toFixed(0)}</td>
                          </tr>
                          {expandedTests[i] && hasAtividades && (
                            <tr key={`${i}-det`}>
                              <td colSpan={4} className="pb-2">
                                <AtividadesTable
                                  atividades={atvs}
                                  testName={a.teste}
                                  fixo={a.fixo}
                                  variavel={a.variavel}
                                  onChange={(newAtvs) => setEditedAtividades(p => ({ ...p, [i]: newAtvs }))}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
