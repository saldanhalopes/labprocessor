import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-react';

interface Atividade {
  descricao: string;
  rota: string;
  execucao: 'MO' | 'MAQ';
  padrao_amostra: 'Padrão' | 'Amostra';
  tempo_min: number;
  injecoes?: number;
  ordem?: number;
}

interface GeminiTimes {
  prep: number;
  run: number;
  calc: number;
  incubation: number;
  locomotion: number;
  setup: number;
  register: number;
}

interface AtividadesTableProps {
  atividades: Atividade[];
  testName: string;
  fixo: { total_min: number; mo_min: number; maq_min: number };
  variavel: { total_min: number; mo_min: number; maq_min: number };
  onChange: (atividades: Atividade[]) => void;
  geminiTimes?: GeminiTimes;
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

export const AtividadesTable: React.FC<AtividadesTableProps> = ({ atividades, testName, fixo, variavel, onChange, geminiTimes }) => {
  const hasHeader = !!testName;
  const [expanded, setExpanded] = useState(!hasHeader);
  const [editing, setEditing] = useState<EditingField>(null);
  const showGemini = !!geminiTimes;

  const sorted = useMemo(() => {
    return [...atividades].sort((a, b) => (a.ordem ?? 9999) - (b.ordem ?? 9999));
  }, [atividades]);

  const totals = useMemo(() => {
    const t: Record<Categoria, { inj: number; tempo: number; count: number }> = {
      corrida: { inj: 0, tempo: 0, count: 0 },
      maquina: { inj: 0, tempo: 0, count: 0 },
      mo: { inj: 0, tempo: 0, count: 0 }
    };
    for (const a of atividades) {
      const cat = getCategoria(a);
      t[cat].tempo += a.tempo_min || 0;
      t[cat].inj += a.injecoes || 0;
      t[cat].count++;
    }
    return t;
  }, [atividades]);

  const grandTempo = totals.corrida.tempo + totals.maquina.tempo + totals.mo.tempo;

  const geminiMapping = useMemo(() => {
    if (!geminiTimes) return null;
    const moAtividades = atividades.filter(a => a.execucao === 'MO');
    const maqAtividades = atividades.filter(a => a.execucao === 'MAQ');
    const totalMO = moAtividades.reduce((s, a) => s + (a.tempo_min || 0), 0);
    const totalMAQ = maqAtividades.reduce((s, a) => s + (a.tempo_min || 0), 0);

    const perActivity: Record<number, number> = {};
    for (const a of atividades) {
      const idx = atividades.indexOf(a);
      if (a.execucao === 'MO' && totalMO > 0) {
        perActivity[idx] = Math.round(((a.tempo_min || 0) / totalMO) * geminiTimes.prep * 10) / 10;
      } else if (a.execucao === 'MAQ' && totalMAQ > 0) {
        perActivity[idx] = Math.round(((a.tempo_min || 0) / totalMAQ) * geminiTimes.run * 10) / 10;
      }
    }

    const geminiOnlyComponents: { label: string; value: number }[] = [];
    if (geminiTimes.calc > 0) geminiOnlyComponents.push({ label: 'Cálculo', value: geminiTimes.calc });
    if (geminiTimes.incubation > 0) geminiOnlyComponents.push({ label: 'Incubação', value: geminiTimes.incubation });
    if (geminiTimes.locomotion > 0) geminiOnlyComponents.push({ label: 'Locomoção', value: geminiTimes.locomotion });
    if (geminiTimes.setup > 0) geminiOnlyComponents.push({ label: 'Setup', value: geminiTimes.setup });
    if (geminiTimes.register > 0) geminiOnlyComponents.push({ label: 'Registro', value: geminiTimes.register });

    const totalGemini = geminiTimes.prep + geminiTimes.run + geminiTimes.calc + geminiTimes.incubation + geminiTimes.locomotion + geminiTimes.setup + geminiTimes.register;

    return { perActivity, geminiOnlyComponents, totalGemini };
  }, [atividades, geminiTimes]);

  const getGeminiTime = (idx: number): number => {
    if (!geminiMapping) return 0;
    return geminiMapping.perActivity[idx] || 0;
  };

  const deltaColor = (bf: number, gemini: number): string => {
    if (bf === 0) return 'text-slate-300';
    const pct = Math.abs(((gemini - bf) / bf) * 100);
    if (pct <= 10) return 'bg-emerald-50 text-emerald-700';
    if (pct <= 30) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-600';
  };

  const deltaPct = (bf: number, gemini: number): string => {
    if (bf === 0) return '—';
    return ((gemini - bf) / bf * 100).toFixed(0) + '%';
  };

  const updateField = (idx: number, field: string, value: any) => {
    const updated = atividades.map((a, i) => i === idx ? { ...a, [field]: value } : a);
    onChange(updated);
  };

  const finishEditing = () => setEditing(null);

  const moveRow = (globalIdx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? globalIdx - 1 : globalIdx + 1;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[globalIdx], reordered[newIdx]] = [reordered[newIdx], reordered[globalIdx]];
    onChange(reordered.map((a, i) => ({ ...a, ordem: i + 1 })));
  };

  const addAtividade = () => {
    const newOrder = (sorted.length > 0 ? Math.max(...sorted.map(a => a.ordem ?? 0)) : 0) + 1;
    onChange([...atividades, { descricao: '', rota: '', execucao: 'MAQ', padrao_amostra: 'Padrão', tempo_min: 0, ordem: newOrder }]);
  };

  const removeAtividade = (globalIdx: number) => {
    onChange(sorted.filter((_, i) => i !== globalIdx).map((a, i) => ({ ...a, ordem: i + 1 })));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') finishEditing();
    if (e.key === 'Escape') finishEditing();
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
      const geminiVal = getGeminiTime(i);
      const delta = geminiVal > 0 ? deltaPct(a.tempo_min, geminiVal) : '—';
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
              onBlur={finishEditing} onKeyDown={handleKeyDown}
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
              onBlur={finishEditing} onKeyDown={handleKeyDown}
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
              onChange={e => { updateField(i, 'execucao', e.target.value); finishEditing(); }}
              onBlur={finishEditing} onKeyDown={handleKeyDown}
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
              onChange={e => { updateField(i, 'padrao_amostra', e.target.value); finishEditing(); }}
              onBlur={finishEditing} onKeyDown={handleKeyDown}
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
              onBlur={finishEditing} onKeyDown={handleKeyDown}
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
              onBlur={finishEditing} onKeyDown={handleKeyDown}
              className="w-20 text-right bg-white border border-indigo-300 px-2 py-1.5 rounded text-xs outline-none font-mono focus:ring-1 focus:ring-indigo-400"
            />,
            'px-4 py-2.5 text-right'
          )}
          {showGemini && (
            <>
            <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-teal-600">
              {geminiVal > 0 ? geminiVal.toFixed(1) : '—'}
            </td>
            <td className="px-4 py-2.5 text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tabular-nums ${deltaColor(a.tempo_min, geminiVal)}`}>
                {delta}
              </span>
            </td>
            </>
          )}
          <td className="px-1 py-2.5 text-center">
            <div className="flex flex-col items-center gap-0.5">
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
            </div>
          </td>
        </tr>
      );
    });

  const renderFooter = () => {
    const cats: Categoria[] = ['corrida', 'maquina', 'mo'];
    const labelColSpan = showGemini ? 7 : 5;
    return (
      <>
        {cats.filter(c => totals[c].count > 0).map(c => {
          const cfg = catConfig[c];
          return (
            <tr key={c} className={`${cfg.row} text-sm font-bold`}>
              <td colSpan={labelColSpan} className="px-4 py-2">
                <span className={`${cfg.text}`}>{cfg.icon} {totals[c].count} {cfg.label}</span>
              </td>
              <td className="px-4 py-2 text-center font-mono text-xs tabular-nums text-slate-500">
                {c === 'corrida' ? totals[c].inj : '—'}
              </td>
              <td className="px-4 py-2 text-right font-mono text-sm tabular-nums text-slate-800">
                {totals[c].tempo.toFixed(1)} min
              </td>
              {showGemini && <><td className="px-4 py-2"></td><td className="px-4 py-2"></td></>}
            </tr>
          );
        })}
        {showGemini && geminiMapping?.geminiOnlyComponents.map((gc, gi) => (
          <tr key={`gem-${gi}`} className="bg-slate-50 text-sm border-b border-slate-100">
            <td colSpan={labelColSpan} className="px-4 py-2">
              <span className="text-teal-600">🧪 {gc.label}</span>
            </td>
            <td className="px-4 py-2 text-center font-mono text-xs tabular-nums text-slate-400">—</td>
            <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-slate-400">—</td>
            <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-teal-600">{gc.value.toFixed(1)}</td>
            <td className="px-4 py-2 text-center font-mono text-xs tabular-nums text-slate-300">—</td>
          </tr>
        ))}
        <tr className="bg-indigo-50/30 font-bold text-sm">
          <td colSpan={labelColSpan} className="px-4 py-2.5 text-indigo-700">TOTAL (BASEFLUXO)</td>
          <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-indigo-500">
            {totals.corrida.inj || '—'}
          </td>
          <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-indigo-700">
            {grandTempo.toFixed(1)} min
          </td>
          {showGemini && (
            <>
            <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-teal-700">
              {geminiMapping ? geminiMapping.totalGemini.toFixed(1) : '—'}
            </td>
            <td className="px-4 py-2.5 text-center">
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tabular-nums ${deltaColor(grandTempo, geminiMapping?.totalGemini || 0)}`}>
                {deltaPct(grandTempo, geminiMapping?.totalGemini || 0)}
              </span>
            </td>
            </>
          )}
        </tr>
      </>
    );
  };

  const fixoTime = fixo?.total_min || 0;
  const varTime = variavel?.total_min || 0;

  return (
    <div>
      {/* Toggle bar — always visible */}
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
                  {showGemini && (
                    <>
                    <th className="px-4 py-3 text-right">Gemini</th>
                    <th className="px-4 py-3 text-center">Δ</th>
                    </>
                  )}
                  <th className="px-2 py-3 text-center w-8">#</th>
                </tr>
              </thead>
              <tbody>
                {renderRows()}
              </tbody>
              <tfoot>
                <tr><td colSpan={showGemini ? 9 : 7} className="p-0"></td></tr>
                {renderFooter()}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
