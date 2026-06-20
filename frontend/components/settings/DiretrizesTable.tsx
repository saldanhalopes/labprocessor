import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Diretriz {
  componente: string;
  descricao: string;
  heuristica: string;
  fixo_min: number;
  var_min: number;
}

interface DiretrizesTableProps {
  diretrizes: Diretriz[];
  onChange: (d: Diretriz[]) => void;
}

export const DiretrizesTable: React.FC<DiretrizesTableProps> = ({ diretrizes, onChange }) => {
  const rows = diretrizes || [];

  const updateRow = (i: number, field: string, value: string | number) => {
    const updated = rows.map((r, j) => j === i ? { ...r, [field]: value } : r);
    onChange(updated);
  };

  const removeRow = (i: number) => {
    onChange(rows.filter((_, j) => j !== i));
  };

  const addRow = () => {
    onChange([...rows, { componente: '', descricao: '', heuristica: '', fixo_min: 0, var_min: 0 }]);
  };

  const totalFixo = rows.reduce((s, r) => s + (Number(r.fixo_min) || 0), 0);
  const totalVar = rows.reduce((s, r) => s + (Number(r.var_min) || 0), 0);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-2 py-1.5 font-medium text-slate-500 w-16">Comp.</th>
            <th className="text-left px-2 py-1.5 font-medium text-slate-500">Descrição</th>
            <th className="text-left px-2 py-1.5 font-medium text-slate-500 hidden md:table-cell">Heurística</th>
            <th className="text-right px-2 py-1.5 font-medium text-slate-500 w-20">Fixo (min)</th>
            <th className="text-right px-2 py-1.5 font-medium text-slate-500 w-20">Var (min)</th>
            <th className="w-6"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="px-2 py-1">
                <input
                  value={r.componente}
                  onChange={e => updateRow(i, 'componente', e.target.value)}
                  placeholder="t_prep"
                  className="w-full px-1 py-0.5 border border-slate-200 rounded text-[10px] font-mono outline-none focus:border-indigo-400 bg-transparent"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  value={r.descricao}
                  onChange={e => updateRow(i, 'descricao', e.target.value)}
                  placeholder="Descrição..."
                  className="w-full px-1 py-0.5 border border-slate-200 rounded text-[10px] outline-none focus:border-indigo-400 bg-transparent"
                />
              </td>
              <td className="px-2 py-1 hidden md:table-cell">
                <input
                  value={r.heuristica}
                  onChange={e => updateRow(i, 'heuristica', e.target.value)}
                  placeholder="Ex: HPLC: gradiente × injeções"
                  className="w-full px-1 py-0.5 border border-slate-200 rounded text-[10px] outline-none focus:border-indigo-400 bg-transparent"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  value={r.fixo_min || ''}
                  onChange={e => updateRow(i, 'fixo_min', Number(e.target.value))}
                  className="w-full px-1 py-0.5 border border-slate-200 rounded text-[10px] font-mono text-right outline-none focus:border-indigo-400 bg-transparent"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  value={r.var_min || ''}
                  onChange={e => updateRow(i, 'var_min', Number(e.target.value))}
                  className="w-full px-1 py-0.5 border border-slate-200 rounded text-[10px] font-mono text-right outline-none focus:border-indigo-400 bg-transparent"
                />
              </td>
              <td className="px-1 py-1">
                <button onClick={() => removeRow(i)} className="p-0.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
          {/* Totals row */}
          <tr className="bg-indigo-50/50 font-bold border-t-2 border-indigo-200">
            <td className="px-2 py-1 text-indigo-600">TOTAIS</td>
            <td className="px-2 py-1"></td>
            <td className="px-2 py-1 hidden md:table-cell"></td>
            <td className="px-2 py-1 text-right font-mono text-indigo-700">{totalFixo}</td>
            <td className="px-2 py-1 text-right font-mono text-indigo-700">{totalVar}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <button onClick={addRow}
        className="w-full py-1 text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-1 border-t border-slate-100 transition-colors">
        <Plus className="w-3 h-3" /> Adicionar componente
      </button>
    </div>
  );
};
