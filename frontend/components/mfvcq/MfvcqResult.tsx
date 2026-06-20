import React from 'react';
import { Clock, FlaskConical, Box, TrendingUp } from 'lucide-react';

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

  const { analises_cq, resumo_tempos, celula, demanda, ativo } = result;

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">
          Resultado: <span className="text-teal-600">{ativo}</span>
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${cellColor(celula)}`}>
          {celula}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Clock className="w-4 h-4" /> Tempo Unitário
          </div>
          <p className="text-2xl font-bold text-slate-800">{resumo_tempos?.tempo_unitario_horas || 0}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Box className="w-4 h-4" /> Lotes
          </div>
          <p className="text-2xl font-bold text-slate-800">{Math.round(demanda?.demanda_em_lotes || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <TrendingUp className="w-4 h-4" /> Demanda Convertida
          </div>
          <p className="text-2xl font-bold text-slate-800">{Math.round(demanda?.demanda_convertida || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <FlaskConical className="w-4 h-4" /> Testes
          </div>
          <p className="text-2xl font-bold text-slate-800">{analises_cq?.length || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h4 className="text-sm font-bold text-slate-700">Fluxo de Análises CQ</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                <th className="text-left px-4 py-3">Teste</th>
                <th className="text-left px-4 py-3">Similaridade</th>
                <th className="text-left px-4 py-3">Rota</th>
                <th className="text-right px-4 py-3">Atividades</th>
                <th className="text-right px-4 py-3">Tempo (min)</th>
              </tr>
            </thead>
            <tbody>
              {analises_cq?.map((a: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.teste}</td>
                  <td className="px-4 py-3 text-slate-500">{a.similaridade}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">{a.rota}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{a.atividades?.length || 0}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                    {a.atividades?.reduce((s: number, at: any) => s + (at.tempo_corrida_minutos || 0), 0)}
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
