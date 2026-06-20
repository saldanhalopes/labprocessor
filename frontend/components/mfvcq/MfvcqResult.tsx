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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Clock className="w-4 h-4" /> Tempo Unitário
          </div>
          <p className="text-2xl font-bold text-slate-800">{resumo_tempos?.tempo_unitario_horas || 0}h</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <User className="w-4 h-4" /> Carga Homem
          </div>
          <p className="text-2xl font-bold text-amber-600">{resumo_tempos?.carga_homem_horas || 0}h</p>
          <p className="text-xs text-slate-400">{resumo_tempos?.carga_homem_pct || 0}% do total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Cpu className="w-4 h-4" /> Carga Máquina
          </div>
          <p className="text-2xl font-bold text-slate-800">{resumo_tempos?.carga_maquina_horas || 0}h</p>
          <p className="text-xs text-slate-400">{100 - (resumo_tempos?.carga_homem_pct || 0)}% do total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <Box className="w-4 h-4" /> Lotes/mês
          </div>
          <p className="text-2xl font-bold text-slate-800">{Math.round(demanda?.demanda_em_lotes || 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
            <FlaskConical className="w-4 h-4" /> Testes
          </div>
          <p className="text-2xl font-bold text-slate-800">{analises_cq?.length || 0}</p>
        </div>
      </div>

      {resumo_tempos?.carga_homem_mensal_h > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-800">Carga Mensal Estimada</p>
          <div className="grid grid-cols-3 gap-4 mt-2">
            <div>
              <span className="text-xs text-amber-600">Analista (MO)</span>
              <p className="text-lg font-bold text-amber-900">{resumo_tempos.carga_homem_mensal_h}h</p>
            </div>
            <div>
              <span className="text-xs text-amber-600">Máquina (MAQ)</span>
              <p className="text-lg font-bold text-amber-900">{resumo_tempos.carga_maquina_mensal_h}h</p>
            </div>
            <div>
              <span className="text-xs text-amber-600">Total</span>
              <p className="text-lg font-bold text-amber-900">{resumo_tempos.tempo_total_lotes_horas}h</p>
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
                <th className="text-left px-4 py-3">Similaridade</th>
                <th className="text-left px-4 py-3">Rota</th>
                <th className="text-right px-4 py-3">Ativ.</th>
                <th className="text-right px-4 py-3">MO</th>
                <th className="text-right px-4 py-3">MAQ</th>
                <th className="text-right px-4 py-3">Total</th>
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
                  <td className="px-4 py-3 text-right font-mono text-amber-600 font-bold">{a.resumo?.mo_min || 0}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">{a.resumo?.maq_min || 0}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                    {(a.resumo?.total_min || a.atividades?.reduce((s: number, at: any) => s + (at.tempo_corrida_minutos || 0), 0))}
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
