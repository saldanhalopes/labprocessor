import React from 'react';
import { Clock, FlaskConical, Box, TrendingUp, User, Cpu } from 'lucide-react';

interface MfvcqResultProps {
  result: any;
}

function cellColor(celula: string) {
  if (!celula) return 'bg-slate-100 text-slate-700';
  if (celula.includes('SÓLIDOS')) return 'bg-blue-100 text-blue-800';
  if (celula.includes('INJET')) return 'bg-purple-100 text-purple-800';
  if (celula.includes('SUSP') || celula.includes('LIQ')) return 'bg-amber-100 text-amber-800';
  if (celula.includes('HORM')) return 'bg-pink-100 text-pink-800';
  return 'bg-teal-100 text-teal-800';
}

export const MfvcqResult: React.FC<MfvcqResultProps> = ({ result }) => {
  if (!result) return null;

  const { analises_cq, resumo_tempos, celula, demanda, ativo, quantidade_lotes } = result;
  const n = quantidade_lotes || 1;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">
            Resultado: <span className="text-teal-600">{ativo}</span>
          </h3>
          <p className="text-sm text-slate-500">{result.descricao || ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">{n} lote(s)</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${cellColor(celula)}`}>{celula}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {n > 1 ? 'Média por lote' : 'Tempo Unitário'}
          </div>
          <p className="text-2xl font-bold text-slate-800">{resumo_tempos?.media_por_lote_horas || resumo_tempos?.tempo_unitario_horas || 0}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
            <User className="w-3 h-3" /> Carga Homem {n > 1 ? `(${n} lotes)` : ''}
          </div>
          <p className="text-2xl font-bold text-amber-600">{resumo_tempos?.carga_homem_horas || 0}h</p>
          <p className="text-xs text-slate-400">{resumo_tempos?.carga_homem_pct || 0}% do total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> Carga Máquina {n > 1 ? `(${n} lotes)` : ''}
          </div>
          <p className="text-2xl font-bold text-slate-800">{resumo_tempos?.carga_maquina_horas || 0}h</p>
          <p className="text-xs text-slate-400">{100 - (resumo_tempos?.carga_homem_pct || 0)}% do total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
            <FlaskConical className="w-3 h-3" /> Testes
          </div>
          <p className="text-2xl font-bold text-slate-800">{analises_cq?.length || 0}</p>
        </div>
      </div>

      {/* Breakdown: Fixo vs Variável */}
      {resumo_tempos?.fixo_horas > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50/50">
            <h4 className="text-sm font-bold text-slate-700">
              📊 Calibração Compartilhada ({n} lote{n > 1 ? 's' : ''})
            </h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-0 divide-x divide-slate-100">
            <div className="p-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Fixo (calibração)</p>
              <p className="text-xl font-bold text-blue-600 mt-1">{resumo_tempos.fixo_horas}h</p>
              <p className="text-xs text-slate-400">1× (curva compartilhada)</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Variável (amostras)</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">{(resumo_tempos.variavel_por_lote_horas * n).toFixed(2)}h</p>
              <p className="text-xs text-slate-400">{resumo_tempos.variavel_por_lote_horas}h × {n} lote{n > 1 ? 's' : ''}</p>
            </div>
            <div className="p-4 col-span-2 md:col-span-1">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total (compartilhado)</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{resumo_tempos.tempo_compartilhado_horas}h</p>
              {resumo_tempos.economia_pct > 0 && (
                <p className="text-xs text-emerald-600 font-medium">Economia de {resumo_tempos.economia_pct}% vs sem compartilhamento</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h4 className="text-sm font-bold text-slate-700">Fluxo de Análises CQ</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                <th className="text-left px-4 py-3">Teste</th>
                <th className="text-left px-4 py-3">Rota</th>
                <th className="text-right px-4 py-3">Fixo (min)</th>
                <th className="text-right px-4 py-3">Var (min)</th>
                <th className="text-right px-4 py-3">Total {n > 1 ? `(${n}x)` : ''}</th>
              </tr>
            </thead>
            <tbody>
              {analises_cq?.map((a: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.teste}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">{a.rota}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600">{a.fixo?.total_min || 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-indigo-600">{a.variavel?.total_min || 0}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                    {a.total_compartilhado_min}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={() => {
          navigator.clipboard.writeText(JSON.stringify(result, null, 2));
        }}
        className="text-xs text-teal-600 hover:text-teal-800 font-medium"
      >
        Copiar JSON
      </button>
    </div>
  );
};
