import React, { useState, useEffect, useCallback } from 'react';
import { Workflow, Plus, X, ChevronDown, ChevronRight, GripVertical, Layers, GitBranch, ArrowRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { SpreadsheetTable } from '../SpreadsheetTable';
import { FlowRouteDiagram } from '../FlowRouteDiagram';

interface Atividade {
  atividade: string;
  rota: string;
  execucao: string;
  padrao_amostra: string;
  tempo_corrida_minutos: number;
  similaridade?: string;
  injecoes?: number;
}

interface Etapa {
  nome: string;
  modo: 'sequencial' | 'paralelo';
  ordem: number;
  atividades: Atividade[];
}

function migrateTestData(testData: any): { etapas: Etapa[]; _meta?: any } {
  if (testData && testData.etapas) return testData;
  if (Array.isArray(testData)) {
    return {
      etapas: [{
        nome: 'Geral',
        modo: 'sequencial' as const,
        ordem: 1,
        atividades: testData
      }],
      _meta: testData._meta
    };
  }
  return { etapas: [] };
}

const atividadeColumns = [
  { key: 'atividade', label: 'Atividade', width: 220, editable: true, type: 'text' as const },
  { key: 'rota', label: 'Rota', width: 160, editable: true, type: 'text' as const },
  { key: 'execucao', label: 'Exec', width: 70, editable: true, type: 'select' as const, options: ['MO', 'MAQ'] },
  { key: 'padrao_amostra', label: 'Padrão/Amostra', width: 110, editable: true, type: 'select' as const, options: ['Padrão', 'Amostra'] },
  { key: 'tempo_corrida_minutos', label: 'Tempo (min)', width: 90, editable: true, type: 'number' as const },
];

export const BasfluxoView: React.FC = () => {
  const [basefluxoData, setBasefluxoData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [expandedFormas, setExpandedFormas] = useState<Set<string>>(new Set());
  const [expandedTestes, setExpandedTestes] = useState<Set<string>>(new Set());
  const [expandedEtapas, setExpandedEtapas] = useState<Set<string>>(new Set());
  const [editingTestName, setEditingTestName] = useState('');
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'diagram'>('spreadsheet');
  const editInputRef = React.useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (editingTestName) {
      setTimeout(() => editInputRef.current?.focus(), 0);
    }
  }, [editingTestName]);

  useEffect(() => {
    fetch('/api/config/skill/basefluxo')
      .then(r => r.json())
      .then(data => setBasefluxoData(data))
      .catch(() => {});
  }, []);

  const getTestData = (forma: string, teste: string) => {
    const raw = basefluxoData[forma]?.[teste];
    return migrateTestData(raw);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config/skill/basefluxo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basefluxoData)
      });
      if (res.ok) showToast('BASEFLUXO salvo!', 'success');
      else showToast('Erro ao salvar BASEFLUXO', 'error');
    } catch { showToast('Erro de conexão', 'error'); }
    finally { setSaving(false); }
  };

  const toggleExpanded = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter((s: Set<string>) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const updateTestData = (forma: string, teste: string, etapas: Etapa[], meta?: any) => {
    const d = { ...basefluxoData };
    d[forma] = { ...d[forma], [teste]: { etapas, _meta: meta || d[forma]?.[teste]?._meta } };
    setBasefluxoData(d);
  };

  const bfAddForma = () => { const name = prompt('Forma farmacêutica (ex: Sólidos):'); if (name) setBasefluxoData(d => ({ ...d, [name]: {} })); };
  const bfRemoveForma = (forma: string) => { const d = { ...basefluxoData }; delete d[forma]; setBasefluxoData(d); };
  const bfAddTeste = (forma: string) => {
    const name = prompt('Nome do teste:');
    if (name) {
      const d = { ...basefluxoData };
      d[forma] = { ...d[forma], [name.toUpperCase()]: { etapas: [{ nome: 'Geral', modo: 'sequencial', ordem: 1, atividades: [] }] } };
      setBasefluxoData(d);
    }
  };
  const bfRemoveTeste = (forma: string, teste: string) => { const d = { ...basefluxoData }; delete d[forma][teste]; setBasefluxoData(d); };
  const bfRenameTeste = (forma: string, oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingTestName(''); return; }
    const d = { ...basefluxoData };
    d[forma][newName] = d[forma][oldName];
    delete d[forma][oldName];
    if (d[forma]._meta?.[oldName]) {
      if (!d[forma]._meta) d[forma]._meta = {};
      d[forma]._meta[newName] = { ...d[forma]._meta[oldName], nome: newName };
      delete d[forma]._meta[oldName];
    }
    setBasefluxoData(d);
    setEditingTestName('');
  };

  const bfAddEtapa = (forma: string, teste: string) => {
    const name = prompt('Nome da etapa:');
    if (!name) return;
    const testData = getTestData(forma, teste);
    const newEtapa: Etapa = {
      nome: name,
      modo: 'sequencial',
      ordem: testData.etapas.length + 1,
      atividades: []
    };
    updateTestData(forma, teste, [...testData.etapas, newEtapa]);
  };

  const bfRemoveEtapa = (forma: string, teste: string, etapaIdx: number) => {
    const testData = getTestData(forma, teste);
    const etapas = testData.etapas.filter((_, i) => i !== etapaIdx).map((e, i) => ({ ...e, ordem: i + 1 }));
    updateTestData(forma, teste, etapas);
  };

  const bfSetEtapaModo = (forma: string, teste: string, etapaIdx: number, modo: 'sequencial' | 'paralelo') => {
    const testData = getTestData(forma, teste);
    const etapas = testData.etapas.map((e, i) => i === etapaIdx ? { ...e, modo } : e);
    updateTestData(forma, teste, etapas);
  };

  const bfMoveEtapa = (forma: string, teste: string, etapaIdx: number, dir: 'up' | 'down') => {
    const testData = getTestData(forma, teste);
    const etapas = [...testData.etapas];
    const newIdx = dir === 'up' ? etapaIdx - 1 : etapaIdx + 1;
    if (newIdx < 0 || newIdx >= etapas.length) return;
    [etapas[etapaIdx], etapas[newIdx]] = [etapas[newIdx], etapas[etapaIdx]];
    updateTestData(forma, teste, etapas.map((e, i) => ({ ...e, ordem: i + 1 })));
  };

  const bfAddAtividade = (forma: string, teste: string, etapaIdx: number) => {
    const testData = getTestData(forma, teste);
    const etapas = [...testData.etapas];
    etapas[etapaIdx] = {
      ...etapas[etapaIdx],
      atividades: [...etapas[etapaIdx].atividades, {
        atividade: '',
        rota: '',
        execucao: 'MAQ',
        padrao_amostra: 'Padrão',
        tempo_corrida_minutos: 0
      }]
    };
    updateTestData(forma, teste, etapas);
  };

  const bfRemoveAtividade = (forma: string, teste: string, etapaIdx: number, atvIdx: number) => {
    const testData = getTestData(forma, teste);
    const etapas = [...testData.etapas];
    etapas[etapaIdx] = {
      ...etapas[etapaIdx],
      atividades: etapas[etapaIdx].atividades.filter((_, i) => i !== atvIdx)
    };
    updateTestData(forma, teste, etapas);
  };

  const bfUpdateAtividade = (forma: string, teste: string, etapaIdx: number, atvIdx: number, field: string, value: any) => {
    const testData = getTestData(forma, teste);
    const etapas = [...testData.etapas];
    const atividades = [...etapas[etapaIdx].atividades];
    atividades[atvIdx] = { ...atividades[atvIdx], [field]: value };
    etapas[etapaIdx] = { ...etapas[etapaIdx], atividades };
    updateTestData(forma, teste, etapas);
  };

  const bfAddAlias = (forma: string, teste: string, alias: string) => {
    if (!alias.trim()) return;
    const d = { ...basefluxoData };
    if (!d[forma]._meta) d[forma]._meta = {};
    if (!d[forma]._meta[teste]) d[forma]._meta[teste] = { nome: teste, aliases: [] };
    d[forma]._meta[teste].aliases = [...new Set([...(d[forma]._meta[teste].aliases || []), alias.trim()])];
    setBasefluxoData(d);
  };

  const bfRemoveAlias = (forma: string, teste: string, alias: string) => {
    const d = { ...basefluxoData };
    if (d[forma]._meta?.[teste]) {
      d[forma]._meta[teste].aliases = (d[forma]._meta[teste].aliases || []).filter((a: string) => a !== alias);
    }
    setBasefluxoData(d);
  };

  const bfGenerateTranslations = (forma: string, teste: string) => {
    const TRANS: Record<string, string> = {
      'TEOR': 'Assay|Valoración|Doseamento|Dosagem',
      'DEGRADAÇÃO': 'Degradation|Degradación|Impurities|Impurezas|Substâncias Relacionadas',
      'DEGRADACAO': 'Degradation|Degradación|Impurities|Impurezas|Substâncias Relacionadas',
      'DISSOLUÇÃO': 'Dissolution|Disolución',
      'DISSOLUCAO': 'Dissolution|Disolución',
      'DESINTEGRAÇÃO': 'Disintegration|Desintegración',
      'DESINTEGRACAO': 'Disintegration|Desintegración',
      'DUREZA': 'Hardness|Dureza',
      'PESO': 'Weight|Average Weight|Peso Promedio',
      'UMIDADE': 'Moisture|Humedad|Water Content|Karl Fischer',
      'UNIFORMIDADE': 'Uniformity|Uniformidad|Content Uniformity|Variação de Peso',
      'HPLC': 'HPLC',
      'MOVIMENTADOR': 'Handler|Manipulador|Sample Handling',
      'FRACIONAMENTO': 'Fractioning|Fraccionamiento',
      'AMOSTRA': 'Sample|Muestra',
      'SEPARAÇÃO': 'Separation|Separación',
      'SEPARACAO': 'Separation|Separación',
      'ROTAÇÃO': 'Rotation|Rotación|Polarimetry',
      'ROTACAO': 'Rotation|Rotación|Polarimetry',
      'IDENTIFICAÇÃO': 'Identification|Identificación',
      'IDENTIFICACAO': 'Identification|Identificación',
      'DESCRIÇÃO': 'Description|Descripción|Appearance',
      'DESCRICAO': 'Description|Descripción|Appearance',
      'SOLUBILIDADE': 'Solubility|Solubilidad',
    };
    const generated = new Set<string>();
    const t = teste.toUpperCase();
    for (const [key, trans] of Object.entries(TRANS)) {
      if (t.includes(key.toUpperCase())) {
        trans.split('|').forEach(a => { if (a.toUpperCase() !== t && !t.includes(a.toUpperCase())) generated.add(a); });
      }
    }
    generated.forEach(a => bfAddAlias(forma, teste, a));
  };

  const calcEtapaTempo = (etapa: Etapa) => {
    if (etapa.modo === 'paralelo') {
      return Math.max(0, ...etapa.atividades.map(a => a.tempo_corrida_minutos || 0));
    }
    return etapa.atividades.reduce((s, a) => s + (a.tempo_corrida_minutos || 0), 0);
  };

  const calcEtapaTempoStr = (etapa: Etapa) => {
    const total = calcEtapaTempo(etapa);
    if (etapa.modo === 'paralelo' && etapa.atividades.length > 1) {
      const sum = etapa.atividades.reduce((s, a) => s + (a.tempo_corrida_minutos || 0), 0);
      const saved = sum - total;
      return `${total} min ${saved > 0 ? `(economia: ${saved} min)` : ''}`;
    }
    return `${total} min`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Workflow className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-bold text-slate-800">BASEFLUXO — Fluxo de CQ</h2>
          <span className="text-xs text-slate-400 ml-auto">
            {Object.keys(basefluxoData).length} formas
          </span>
          <div className="flex bg-slate-100 rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setViewMode('spreadsheet')}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'spreadsheet' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Planilha
            </button>
            <button
              onClick={() => setViewMode('diagram')}
              className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${viewMode === 'diagram' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Diagrama
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Gerencie o fluxo de CQ por forma farmacêutica. Organize testes em etapas sequenciais ou paralelas.
        </p>

        <button onClick={bfAddForma}
          className="mb-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nova Forma
        </button>

        <div className="space-y-4">
          {Object.entries(basefluxoData).map(([forma, testes]: [string, any]) => {
            const isFormaOpen = expandedFormas.has(forma);
            const testeKeys = Object.keys(testes || {}).filter(k => k !== '_meta');
            return (
              <div key={forma} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                  onClick={() => toggleExpanded(setExpandedFormas, forma)}>
                  <div className="flex items-center gap-2">
                    {isFormaOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span className="font-bold text-slate-700">{forma}</span>
                    <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded">{testeKeys.length} testes</span>
                  </div>
                  <button onClick={e => { e.stopPropagation(); bfRemoveForma(forma); }}
                    className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>

                {isFormaOpen && (
                  <div className="border-t border-slate-100">
                    <div className="p-2 flex items-center gap-2">
                      <button onClick={e => { e.stopPropagation(); bfAddTeste(forma); }}
                        className="px-3 py-1 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-lg flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Teste
                      </button>
                    </div>

                    {testeKeys.length === 0 && (
                      <div className="px-5 py-4 text-xs text-slate-400">
                        Nenhum teste. Clique em "Teste" para adicionar.
                      </div>
                    )}

                    {testeKeys.map(teste => {
                      const isTesteOpen = expandedTestes.has(`${forma}/${teste}`);
                      const testData = getTestData(forma, teste);
                      const totalAtividades = testData.etapas.reduce((s, e) => s + e.atividades.length, 0);

                      return (
                        <div key={teste} className="border-t border-slate-100">
                          <div className="flex items-center justify-between px-5 py-2 hover:bg-slate-50 cursor-pointer"
                            onClick={e => { e.stopPropagation(); toggleExpanded(setExpandedTestes, `${forma}/${teste}`); }}>
                            <div className="flex items-center gap-2">
                              {isTesteOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                              <span className="text-sm font-semibold text-slate-600">{teste}</span>
                              <button onClick={e => { e.stopPropagation(); setEditingTestName(`${forma}/${teste}`); }}
                                className="p-0.5 rounded hover:bg-teal-100 text-slate-400 hover:text-teal-600"
                                title="Renomear teste">✎</button>
                              <span className="text-[10px] text-slate-400">{totalAtividades} atv · {testData.etapas.length} etapas</span>
                            </div>
                            <button onClick={e => { e.stopPropagation(); bfRemoveTeste(forma, teste); }}
                              className="p-0.5 rounded hover:bg-red-100 text-red-400"><X className="w-3 h-3" /></button>
                          </div>

                          {isTesteOpen && (
                            <div className="px-5 pb-3">
                              {editingTestName === `${forma}/${teste}` && (
                                <div className="mb-2 flex items-center gap-1">
                                  <input defaultValue={teste} autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') bfRenameTeste(forma, teste, (e.target as HTMLInputElement).value);
                                      if (e.key === 'Escape') setEditingTestName('');
                                    }}
                                    className="text-sm font-semibold text-slate-700 bg-white border border-teal-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400 w-48" />
                                  <button onClick={e => {
                                    const inp = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                                    if (inp) bfRenameTeste(forma, teste, inp.value);
                                  }}
                                    className="px-2 py-0.5 bg-teal-600 text-white rounded text-[10px] font-bold hover:bg-teal-700">Salvar</button>
                                  <button onClick={() => setEditingTestName('')} className="text-[10px] text-slate-400 hover:text-red-500">cancelar</button>
                                </div>
                              )}

                              <div className="mb-3 flex flex-wrap items-center gap-1">
                                {(basefluxoData[forma]?._meta?.[teste]?.aliases || []).map((alias: string) => (
                                  <span key={alias} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-[11px] text-indigo-700">
                                    {alias}
                                    <button onClick={() => bfRemoveAlias(forma, teste, alias)} className="ml-0.5 hover:text-red-500">&times;</button>
                                  </span>
                                ))}
                                <input placeholder="+ alias"
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { bfAddAlias(forma, teste, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; }
                                  }}
                                  className="w-24 px-1.5 py-0.5 border border-dashed border-slate-300 rounded-full text-[11px] outline-none focus:border-indigo-400" />
                                <button onClick={() => bfGenerateTranslations(forma, teste)}
                                  className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold hover:bg-emerald-200"
                                  title="Gerar traduções PT/EN/ES">{'\u{1F310}'} Traduzir</button>
                              </div>

                              {viewMode === 'spreadsheet' ? (
                                <div className="space-y-3">
                                  {testData.etapas.map((etapa, etapaIdx) => {
                                    const isEtapaOpen = expandedEtapas.has(`${forma}/${teste}/${etapaIdx}`);
                                    const etapaTotal = calcEtapaTempoStr(etapa);
                                    return (
                                      <div key={etapaIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                                        <div
                                          className="flex items-center justify-between px-3 py-2 bg-slate-50/80 cursor-pointer hover:bg-slate-100"
                                          onClick={() => toggleExpanded(setExpandedEtapas, `${forma}/${teste}/${etapaIdx}`)}
                                        >
                                          <div className="flex items-center gap-2">
                                            <GripVertical className="w-3 h-3 text-slate-400" />
                                            {isEtapaOpen ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                                            <Layers className="w-3.5 h-3.5 text-teal-600" />
                                            <span className="text-xs font-bold text-slate-700">{etapa.nome}</span>
                                            <span className="text-[10px] text-slate-400">({etapa.modo})</span>
                                            <span className="text-[10px] text-slate-500 ml-2">{etapaTotal}</span>
                                          </div>
                                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                            <select
                                              value={etapa.modo}
                                              onChange={e => bfSetEtapaModo(forma, teste, etapaIdx, e.target.value as 'sequencial' | 'paralelo')}
                                              className="text-[10px] border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-teal-400"
                                            >
                                              <option value="sequencial">Sequencial</option>
                                              <option value="paralelo">Paralelo</option>
                                            </select>
                                            <button onClick={() => bfMoveEtapa(forma, teste, etapaIdx, 'up')}
                                              className="p-0.5 text-slate-400 hover:text-slate-600" title="Mover para cima">▲</button>
                                            <button onClick={() => bfMoveEtapa(forma, teste, etapaIdx, 'down')}
                                              className="p-0.5 text-slate-400 hover:text-slate-600" title="Mover para baixo">▼</button>
                                            <button onClick={() => bfRemoveEtapa(forma, teste, etapaIdx)}
                                              className="p-0.5 rounded hover:bg-red-100 text-red-400"><X className="w-3 h-3" /></button>
                                          </div>
                                        </div>

                                        {isEtapaOpen && (
                                          <div className="p-2">
                                            <SpreadsheetTable
                                              columns={atividadeColumns}
                                              data={etapa.atividades}
                                              onCellChange={(rowIdx, colKey, value) => bfUpdateAtividade(forma, teste, etapaIdx, rowIdx, colKey, value)}
                                              onRowAdd={() => bfAddAtividade(forma, teste, etapaIdx)}
                                              onRowDelete={(rowIdx) => bfRemoveAtividade(forma, teste, etapaIdx, rowIdx)}
                                              searchPlaceholder="Filtrar atividades..."
                                              emptyMessage="Nenhuma atividade nesta etapa."
                                            />
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  <button
                                    onClick={() => bfAddEtapa(forma, teste)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-teal-600 border border-dashed border-teal-300 rounded-lg hover:bg-teal-50 w-full justify-center"
                                  >
                                    <Plus className="w-3 h-3" />
                                    Nova Etapa
                                  </button>
                                </div>
                              ) : (
                                <FlowRouteDiagram etapas={testData.etapas} testName={teste} />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
          {saving ? 'Salvando...' : 'Salvar BASEFLUXO'}
        </button>
      </div>
    </div>
  );
};
