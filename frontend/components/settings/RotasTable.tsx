import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

interface RotaDiretriz {
  componente: string;
  descricao: string;
  fixo_min: number;
  var_min: number;
}

interface Rota {
  nome: string;
  tipo: string;
  execucao: string;
  descricao: string;
  diretrizes: RotaDiretriz[];
}

interface RotasTableProps {
  rotas: Rota[];
  onChange: (rotas: Rota[]) => void;
}

export const RotasTable: React.FC<RotasTableProps> = ({ rotas, onChange }) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (i: number) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const updateRota = (i: number, field: string, value: any) => {
    onChange(rotas.map((r, j) => j === i ? { ...r, [field]: value } : r));
  };

  const addRota = () => {
    onChange([...rotas, { nome: '', tipo: 'Máquina', execucao: 'MAQ', descricao: '', diretrizes: [] }]);
  };

  const removeRota = (i: number) => onChange(rotas.filter((_, j) => j !== i));

  const updateDiretriz = (rotaIdx: number, dirIdx: number, field: string, value: any) => {
    const updated = rotas.map((r, i) => {
      if (i !== rotaIdx) return r;
      return { ...r, diretrizes: r.diretrizes.map((d, j) => j === dirIdx ? { ...d, [field]: value } : d) };
    });
    onChange(updated);
  };

  const addDiretriz = (rotaIdx: number) => {
    const updated = rotas.map((r, i) => {
      if (i !== rotaIdx) return r;
      return { ...r, diretrizes: [...r.diretrizes, { componente: '', descricao: '', fixo_min: 0, var_min: 0 }] };
    });
    onChange(updated);
  };

  const removeDiretriz = (rotaIdx: number, dirIdx: number) => {
    const updated = rotas.map((r, i) => {
      if (i !== rotaIdx) return r;
      return { ...r, diretrizes: r.diretrizes.filter((_, j) => j !== dirIdx) };
    });
    onChange(updated);
  };

  const totalFixoTeste = rotas.reduce((s, r) => s + (r.diretrizes||[]).reduce((a, d) => a + (Number(d.fixo_min) || 0), 0), 0);
  const totalVarTeste = rotas.reduce((s, r) => s + (r.diretrizes||[]).reduce((a, d) => a + (Number(d.var_min) || 0), 0), 0);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {rotas.map((r, i) => {
        const totalFixoRota = r.diretrizes.reduce((s, d) => s + (Number(d.fixo_min) || 0), 0);
        const totalVarRota = r.diretrizes.reduce((s, d) => s + (Number(d.var_min) || 0), 0);
        const icon = r.execucao === 'MO' ? '👤' : '🤖';

        return (
          <div key={i} className="border-b border-slate-100 last:border-b-0">
            {/* Rota header */}
            <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer" onClick={() => toggle(i)}>
              <span className="text-[10px]">{icon}</span>
              <input
                value={r.nome}
                onChange={e => updateRota(i, 'nome', e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Nome da rota..."
                className="flex-1 px-1.5 py-0.5 border border-slate-200 rounded text-[10px] font-mono outline-none focus:border-indigo-400 bg-transparent"
              />
              <select value={r.tipo} onChange={e => updateRota(i, 'tipo', e.target.value)} onClick={e => e.stopPropagation()}
                className="px-1 py-0.5 border border-slate-200 rounded text-[10px] bg-transparent">
                <option value="Máquina">🤖 Máquina</option>
                <option value="Analista">👤 Analista</option>
              </select>
              <input
                value={r.descricao}
                onChange={e => updateRota(i, 'descricao', e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="Descrição..."
                className="w-32 px-1.5 py-0.5 border border-slate-200 rounded text-[10px] outline-none focus:border-indigo-400 bg-transparent hidden md:block"
              />
              <span className="text-[9px] text-slate-400 font-mono">{r.diretrizes.length} dir</span>
              {expanded[i] ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
              <button onClick={(e) => { e.stopPropagation(); removeRota(i); }} className="p-0.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Diretrizes sub-table */}
            {expanded[i] && (
              <div className="bg-slate-50/50 border-t border-slate-100">
                {r.diretrizes.length > 0 && (
                  <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left px-3 py-0.5 font-medium">Componente</th>
                      <th className="text-left px-3 py-0.5 font-medium">Descrição</th>
                      <th className="text-right px-3 py-0.5 font-medium w-16">Fixo</th>
                      <th className="text-right px-3 py-0.5 font-medium w-16">Var</th>
                      <th className="w-5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.diretrizes.map((d, di) => (
                      <tr key={di} className="border-b border-slate-50">
                        <td className="px-3 py-0.5">
                          <input value={d.componente} onChange={e => updateDiretriz(i, di, 'componente', e.target.value)}
                            className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono outline-none focus:border-indigo-400" />
                        </td>
                        <td className="px-3 py-0.5">
                          <input value={d.descricao} onChange={e => updateDiretriz(i, di, 'descricao', e.target.value)}
                            className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] outline-none focus:border-indigo-400" />
                        </td>
                        <td className="px-3 py-0.5">
                          <input type="number" value={d.fixo_min || ''} onChange={e => updateDiretriz(i, di, 'fixo_min', Number(e.target.value))}
                            className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono text-right outline-none focus:border-indigo-400" />
                        </td>
                        <td className="px-3 py-0.5">
                          <input type="number" value={d.var_min || ''} onChange={e => updateDiretriz(i, di, 'var_min', Number(e.target.value))}
                            className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono text-right outline-none focus:border-indigo-400" />
                        </td>
                        <td className="px-1 py-0.5">
                          <button onClick={() => removeDiretriz(i, di)} className="p-0.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600"><Trash2 className="w-2.5 h-2.5" /></button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50/50 font-bold">
                      <td className="px-3 py-0.5 text-blue-600 text-[9px]">TOTAIS ROTA</td>
                      <td></td>
                      <td className="px-3 py-0.5 text-right font-mono text-blue-700 text-[9px]">{totalFixoRota}</td>
                      <td className="px-3 py-0.5 text-right font-mono text-blue-700 text-[9px]">{totalVarRota}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
                )}
                <button onClick={() => addDiretriz(i)}
                  className="w-full py-0.5 text-[9px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-1 transition-colors">
                  <Plus className="w-2.5 h-2.5" /> Adicionar componente
                </button>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={addRota}
        className="w-full py-1.5 text-[10px] text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1 transition-colors">
        <Plus className="w-3 h-3" /> Adicionar rota
      </button>
      {/* Test totals */}
      <div className="flex items-center justify-end gap-4 px-3 py-1.5 bg-indigo-50/30 border-t border-indigo-100 text-[10px] font-bold">
        <span className="text-indigo-600">TOTAIS DO TESTE</span>
        <span className="text-indigo-700 font-mono">Fixo {totalFixoTeste} min</span>
        <span className="text-indigo-700 font-mono">Variável {totalVarTeste} min</span>
      </div>
    </div>
  );
};
