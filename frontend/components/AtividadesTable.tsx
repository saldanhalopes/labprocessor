import React, { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Plus, Trash2, Save, X } from 'lucide-react';

interface Atividade {
  descricao: string;
  rota: string;
  execucao: 'MO' | 'MAQ';
  padrao_amostra: 'Padrão' | 'Amostra';
  tempo_min: number;
  injecoes?: number;
  ordem?: number;
}

interface AtividadesTableProps {
  atividades: Atividade[];
  testName: string;
  fixo: { total_min: number; mo_min: number; maq_min: number };
  variavel: { total_min: number; mo_min: number; maq_min: number };
  onChange: (atividades: Atividade[]) => void;
}

type Categoria = 'corrida' | 'maquina' | 'mo';

function getCategoria(a: Atividade): Categoria {
  if (a.injecoes !== undefined && a.injecoes > 0) return 'corrida';
  if (a.execucao === 'MAQ') return 'maquina';
  return 'mo';
}

const catConfig: Record<Categoria, { label: string; row: string; text: string; icon: string }> = {
  corrida: { label: 'Corrida', row: 'bg-blue-50/20', text: 'text-blue-700', icon: '🔵' },
  maquina: { label: 'Máq. fixa', row: 'bg-slate-50', text: 'text-slate-500', icon: '⚙️' },
  mo:        { label: 'MO', row: 'bg-amber-50/20', text: 'text-amber-700', icon: '👤' }
};

type EditingField = { rowIdx: number; field: string } | null;

export const AtividadesTable: React.FC<AtividadesTableProps> = ({ atividades, testName, fixo, variavel, onChange }) => {
  const hasHeader = !!testName;
  const [expanded, setExpanded] = useState(!hasHeader);
  const [editing, setEditing] = useState<EditingField>(null);
  const [draft, setDraft] = useState<Atividade[] | null>(null);

  const working = draft || atividades;

  const commitDraft = useCallback(() => {
    if (draft) {
      onChange(draft);
      setDraft(null);
    }
    setEditing(null);
  }, [draft, onChange]);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setEditing(null);
  }, []);

  const sorted = useMemo(() => {
    return [...working].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
  }, [working]);

  const totals = useMemo(() => {
    const t: Record<Categoria, { inj: number; tempo: number; count: number }> = {
      corrida: { inj: 0, tempo: 0, count: 0 },
      maquina: { inj: 0, tempo: 0, count: 0 },
      mo: { inj: 0, tempo: 0, count: 0 }
    };
    for (const a of working) {
      const cat = getCategoria(a);
      t[cat].tempo += a.tempo_min || 0;
      t[cat].inj += a.injecoes || 0;
      t[cat].count++;
    }
    return t;
  }, [working]);

  const grandTempo = totals.corrida.tempo + totals.maquina.tempo + totals.mo.tempo;

  const updateField = (idx: number, field: string, value: any) => {
    const base = draft || atividades;
    const sortedBase = [...base].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
    if (idx < 0 || idx >= sortedBase.length) return;
    const target = sortedBase[idx];
    const updated = base.map(a => a === target ? { ...a, [field]: value } : a);
    setDraft(updated);
  };

  const addAtividade = () => {
    const base = atividades;
    const newOrder = (base.length > 0 ? Math.max(...base.map(a => a.ordem ?? 0)) : 0) + 1;
    const updated = [...base, { descricao: '', rota: '', execucao: 'MAQ', padrao_amostra: 'Padrão', tempo_min: 0, ordem: newOrder }];
    if (draft) {
      setDraft([...draft, { descricao: '', rota: '', execucao: 'MAQ', padrao_amostra: 'Padrão', tempo_min: 0, ordem: newOrder }]);
    } else {
      onChange(updated);
    }
  };

  const moveRow = (globalIdx: number, direction: 'up' | 'down') => {
    const base = draft || [...atividades];
    const reordered = [...base].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
    const newIdx = direction === 'up' ? globalIdx - 1 : globalIdx + 1;
    if (newIdx < 0 || newIdx >= reordered.length) return;
    [reordered[globalIdx], reordered[newIdx]] = [reordered[newIdx], reordered[globalIdx]];
    const result = reordered.map((a, i) => ({ ...a, ordem: i + 1 }));
    onChange(result);
    setDraft(null);
    setEditing(null);
  };

  const removeAtividade = (globalIdx: number) => {
    const list = [...(draft || atividades)].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
    const result = list.filter((_, i) => i !== globalIdx).map((a, i) => ({ ...a, ordem: i + 1 }));
    onChange(result);
    setDraft(null);
    setEditing(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitDraft();
    if (e.key === 'Escape') cancelDraft();
  };

  const renderCell = (
    idx: number,
    field: string,
    display: React.ReactNode,
    editor: React.ReactNode,
    cellClass: string = '',
  ) => {
    if (editing?.rowIdx === idx && editing?.field === field) {
      return (
        <td className={cellClass}>
          {editor}
        </td>
      );
    }
    return (
      <td className={`${cellClass} cursor-pointer hover:bg-indigo-50/30 transition-colors min-h-[32px]`}
        onClick={() => setEditing({ rowIdx: idx, field })}
        title="Clique para editar"
      >
        {display}
      </td>
    );
  };

  const renderRows = () =>
    sorted.map((a, i) => {
      const cat = getCategoria(a);
      const cfg = catConfig[cat];
      const isFirst = i === 0;
      const isLast = i === sorted.length - 1;
      const pct = grandTempo > 0 ? `${((a.tempo_min / grandTempo) * 100).toFixed(0)}%` : '—';
      return (
        <tr key={i} className={`border-b border-slate-100 text-sm ${cfg.row} hover:bg-slate-100/50 transition-colors`}>
          {renderCell(
            i, 'descricao',
            <span className="text-slate-800 truncate block max-w-[280px]" title={a.descricao}>
              <span className="mr-1.5 opacity-60">{cfg.icon}</span>
              {a.descricao}
            </span>,
            <input
              type="text" autoFocus
              value={a.descricao}
              onChange={e => updateField(i, 'descricao', e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full max-w-[280px] bg-white border border-indigo-300 px-2 py-1.5 rounded text-xs outline-none font-medium focus:ring-1 focus:ring-indigo-400"
            />,
            'px-4 py-2.5'
          )}
          {renderCell(
            i, 'rota',
            <span className="text-slate-500 font-mono text-xs truncate block max-w-[150px]" title={a.rota}>{a.rota}</span>,
            <input
              type="text" autoFocus
              value={a.rota}
              onChange={e => updateField(i, 'rota', e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full max-w-[150px] bg-white border border-indigo-300 px-2 py-1.5 rounded text-xs outline-none font-mono focus:ring-1 focus:ring-indigo-400"
            />,
            'px-4 py-2.5'
          )}
          {renderCell(
            i, 'execucao',
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${a.execucao === 'MO' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {a.execucao}
            </span>,
            <select
              autoFocus
              value={a.execucao}
              onChange={e => updateField(i, 'execucao', e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-white border border-indigo-300 rounded px-1 py-1.5 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="MO">MO</option>
              <option value="MAQ">MAQ</option>
            </select>,
            'px-4 py-2.5 text-center'
          )}
          {renderCell(
            i, 'padrao_amostra',
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${a.padrao_amostra === 'Padrão' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {a.padrao_amostra === 'Padrão' ? 'Padrão' : 'Amostra'}
            </span>,
            <select
              autoFocus
              value={a.padrao_amostra}
              onChange={e => updateField(i, 'padrao_amostra', e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-white border border-indigo-300 rounded px-1 py-1.5 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="Padrão">Padrão</option>
              <option value="Amostra">Amostra</option>
            </select>,
            'px-4 py-2.5 text-center'
          )}
          {renderCell(
            i, 'injecoes',
            <span className="text-slate-400 font-mono text-xs tabular-nums">
              {a.injecoes !== undefined && a.injecoes > 0 ? a.injecoes : '—'}
            </span>,
            <input
              type="number" step="1" min="0" autoFocus
              value={a.injecoes || ''}
              onChange={e => updateField(i, 'injecoes', parseInt(e.target.value) || 0)}
              onKeyDown={handleKeyDown}
              className="w-16 text-center bg-white border border-indigo-300 px-2 py-1.5 rounded text-xs outline-none font-mono focus:ring-1 focus:ring-indigo-400"
            />,
            'px-4 py-2.5 text-center'
          )}
          {renderCell(
            i, 'tempo_min',
            <span className="font-mono text-xs tabular-nums text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors inline-block min-w-[48px] text-right">
              {a.tempo_min.toFixed(1)}
            </span>,
            <input
              type="number" step="0.1" autoFocus
              value={a.tempo_min}
              onChange={e => updateField(i, 'tempo_min', parseFloat(e.target.value) || 0)}
              onKeyDown={handleKeyDown}
              className="w-20 text-right bg-white border border-indigo-300 px-2 py-1.5 rounded text-xs outline-none font-mono focus:ring-1 focus:ring-indigo-400"
            />,
            'px-4 py-2.5 text-right'
          )}
          <td className="px-2 py-2.5 text-right font-mono text-[9px] tabular-nums text-slate-400">
            {pct}
          </td>
          <td className="px-1 py-2.5 text-center">
            <div className="flex flex-col items-center gap-0.5">
              {editing && draft ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); commitDraft(); }}
                    className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    title="Salvar alterações"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelDraft(); }}
                    className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors"
                    title="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveRow(i, 'up'); }}
                    disabled={isFirst}
                    className="p-0.5 rounded hover:bg-indigo-100 text-slate-300 hover:text-indigo-600 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                    title="Mover para cima"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveRow(i, 'down'); }}
                    disabled={isLast}
                    className="p-0.5 rounded hover:bg-indigo-100 text-slate-300 hover:text-indigo-600 disabled:opacity-20 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                    title="Mover para baixo"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAtividade(i); }}
                    className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors mt-0.5"
                    title="Remover atividade"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </td>
        </tr>
      );
    });

  const renderFooter = () => {
    const cats: Categoria[] = ['corrida', 'maquina', 'mo'];
    return (
      <>
        {cats.filter(c => totals[c].count > 0).map(c => {
          const cfg = catConfig[c];
          const catPct = grandTempo > 0 ? `${((totals[c].tempo / grandTempo) * 100).toFixed(0)}%` : '—';
          return (
            <tr key={c} className={`${cfg.row} text-sm font-bold`}>
              <td colSpan={7} className="px-4 py-2">
                <span className={`${cfg.text}`}>{cfg.icon} {totals[c].count} {cfg.label}</span>
              </td>
              <td className="px-4 py-2 text-center font-mono text-xs tabular-nums text-slate-500">
                {c === 'corrida' ? totals[c].inj : '—'}
              </td>
              <td className="px-4 py-2 text-right font-mono text-sm tabular-nums text-slate-800">
                {totals[c].tempo.toFixed(1)} min
              </td>
              <td className="px-2 py-2 text-right font-mono text-[9px] tabular-nums text-slate-400">
                {catPct}
              </td>
            </tr>
          );
        })}
        <tr className="bg-indigo-50/30 font-bold text-sm">
          <td colSpan={7} className="px-4 py-2.5 text-indigo-700">TOTAL</td>
          <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-indigo-500">
            {totals.corrida.inj || '—'}
          </td>
          <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-indigo-700">
            {grandTempo.toFixed(1)} min
          </td>
          <td className="px-2 py-2.5 text-right font-mono text-[9px] tabular-nums text-slate-400">
            100%
          </td>
        </tr>
      </>
    );
  };

  const fixoTime = fixo?.total_min || 0;
  const varTime = variavel?.total_min || 0;

  return (
    <div>
      <div className="flex items-center gap-2">
        {hasHeader ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-left"
          >
            <span className="text-sm font-bold text-slate-700">{testName}</span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              Fixo {fixoTime.toFixed(0)}min · Var {varTime.toFixed(0)}min/lote · {atividades.length} atividades
            </span>
            <span className="ml-auto text-xs text-slate-400 font-mono">
              🔵{totals.corrida.count} ⚙️{totals.maquina.count} 👤{totals.mo.count}
            </span>
            <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            </span>
          </button>
        ) : (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-left text-xs font-mono text-slate-500"
            >
              <span className="tabular-nums">{atividades.length} atividades</span>
              {draft && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" title="Alterações não salvas" />}
              <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </span>
            </button>
          </>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); addAtividade(); }}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-bold flex-shrink-0"
        >
          <Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>

      {draft && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-[11px] font-bold text-amber-700">Alterações não salvas</span>
          <div className="ml-auto flex gap-2">
            <button onClick={commitDraft} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-[10px] font-bold transition-colors shadow-sm">
              <Save className="w-3 h-3" /> Salvar
            </button>
            <button onClick={cancelDraft} className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 text-[10px] font-bold transition-colors">
              <X className="w-3 h-3" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Atividade</th>
                  <th className="px-4 py-3">Rota</th>
                  <th className="px-4 py-3 text-center">Exec</th>
                  <th className="px-4 py-3 text-center">P/A</th>
                  <th className="px-4 py-3 text-center">Inj</th>
                  <th className="px-4 py-3 text-right">Tempo (min)</th>
                  <th className="px-2 py-3 text-right">%</th>
                  <th className="px-2 py-3 text-center w-8">#</th>
                </tr>
              </thead>
              <tbody>
                {renderRows()}
              </tbody>
              <tfoot>
                <tr><td colSpan={8} className="p-0"></td></tr>
                {renderFooter()}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
