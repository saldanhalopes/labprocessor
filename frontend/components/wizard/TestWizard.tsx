import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Plus, Loader2 } from 'lucide-react';

interface TestWizardProps {
  testName: string;
  technique: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}

const AVAILABLE_ROUTES = [
  'HPLC DAD', 'HPLC UV', 'BALANÇA', 'BALANÇA IV', 'BALANÇA ANALÍTICA',
  'ANALISTA BANCADA (PREP HPLC)', 'ANALISTA EQUIP - HPLC', 'ANALISTA TF',
  'ULTRASSOM', 'BOMBA DE LAVAGEM', 'CONJ FILTRO', 'AGITADOR',
  'DISSOLUTOR', 'DESINTEGRADOR', 'DURÔMETRO', 'MILLIQ', 'pHMETRO',
  'AUXILIAR COLUNAS', 'AUXILIAR FRACIONADOR', 'AUXILIAR MOVIMENTADOR',
  'ESPECTROFOTÔMETRO AA', 'ESPECTROFOTÔMETRO UV-VIS', 'ESPECTROFOTÔMETRO IV',
  'CROMATÓGRAFO A GÁS', 'AMOSTRADOR HEADSPACE', 'CAPELA DE EXAUSTÃO',
  'CHAPA AQUECEDORA', 'MUFFLA', 'ESTUFA', 'TITULADOR KARL FISCHER'
];

const TECHNIQUES = ['HPLC', 'CG', 'Espectrofotometria', 'Dissolução', 'Desintegração', 'Dureza', 'Gravimetria', 'Karl Fischer', 'Visual', 'Potenciometria', 'Polarimetria', 'Microbiologia', 'Outros'];
const CATEGORIES = ['Físico-Químico', 'Microbiológico', 'Visual', 'Identificação', 'Outros'];
const FORMS = ['Sólidos', 'Líquidos', 'Injetáveis', 'Cremes/Pomadas', 'Matéria-Prima', 'Todos'];

function suggestRoutes(technique: string): string[] {
  const t = (technique || '').toUpperCase();
  if (t.includes('HPLC') || t.includes('CROMATOGRAFIA LIQUIDA') || t.includes('CROMATOGRAFO LIQUIDO'))
    return ['HPLC DAD', 'BALANÇA', 'ANALISTA BANCADA (PREP HPLC)', 'ANALISTA EQUIP - HPLC', 'ULTRASSOM', 'BOMBA DE LAVAGEM', 'CONJ FILTRO', 'AGITADOR', 'AUXILIAR COLUNAS'];
  if (t.includes('CG') || t.includes('GASOSA') || t.includes('HEADSPACE'))
    return ['CROMATÓGRAFO A GÁS', 'AMOSTRADOR HEADSPACE', 'BALANÇA', 'ANALISTA BANCADA (PREP HPLC)'];
  if (t.includes('DISSOLU'))
    return ['DISSOLUTOR', 'HPLC UV', 'BALANÇA', 'ANALISTA BANCADA (PREP HPLC)', 'MILLIQ', 'pHMETRO'];
  if (t.includes('ESPECTROFOTOMETRIA') || t.includes('AA') || t.includes('ABSORCAO') || t.includes('ABSORÇÃO'))
    return ['ESPECTROFOTÔMETRO AA', 'BALANÇA', 'CAPELA DE EXAUSTÃO', 'ANALISTA BANCADA (PREP HPLC)'];
  if (t.includes('KARL FISCHER') || t.includes('UMIDADE'))
    return ['BALANÇA IV', 'ANALISTA TF', 'TITULADOR KARL FISCHER'];
  if (t.includes('ESPECTROFOTOMETRIA') && (t.includes('UV') || t.includes('VIS')))
    return ['ESPECTROFOTÔMETRO UV-VIS', 'BALANÇA', 'ANALISTA BANCADA (PREP HPLC)'];
  if (t.includes('MICROBIOLOGIA') || t.includes('MICROBIOL'))
    return ['AUTOCLAVE', 'ESTUFA', 'CAPELA DE FLUXO LAMINAR', 'BALANÇA', 'ANALISTA BANCADA (PREP HPLC)'];
  return ['BALANÇA', 'ANALISTA BANCADA (PREP HPLC)'];
}

export const TestWizard: React.FC<TestWizardProps> = ({ testName, technique, onClose, onSaved }) => {
  const [step, setStep] = useState(1);
  const [tecnica, setTecnica] = useState(technique || '');
  const [categoria, setCategoria] = useState('Físico-Químico');
  const [forma, setForma] = useState('Sólidos');
  const [rotas, setRotas] = useState<string[]>([]);
  const [customRota, setCustomRota] = useState('');
  const [moPct, setMoPct] = useState(50);
  const [fixoMin, setFixoMin] = useState(0);
  const [varMin, setVarMin] = useState(0);
  const [aliases, setAliases] = useState<string[]>([testName]);
  const [customAlias, setCustomAlias] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRotas(suggestRoutes(technique));
    setAliases([testName]);
    setTecnica(technique || '');
  }, [testName, technique]);

  const toggleRota = (r: string) => {
    setRotas(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const addRota = () => {
    if (customRota.trim() && !rotas.includes(customRota.trim())) {
      setRotas(prev => [...prev, customRota.trim()]);
      setCustomRota('');
    }
  };

  const toggleAlias = (a: string) => {
    setAliases(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };

  const addAlias = () => {
    if (customAlias.trim() && !aliases.includes(customAlias.trim())) {
      setAliases(prev => [...prev, customAlias.trim()]);
      setCustomAlias('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Load existing tests
      const res = await fetch('/api/config/skill/tests');
      const existing = await res.json();
      existing[testName] = {
        tecnica: tecnica || technique,
        categoria,
        forma,
        rotas,
        aliases,
        mo_pct: moPct,
        fixo_min: fixoMin,
        var_min: varMin,
        descricao,
        diretrizes: {
          t_prep: `Preparo de amostras e padrões para ${testName}`,
          t_analysis: `Manipulação durante análise de ${testName}`,
          t_run: `Tempo de corrida instrumental`,
          t_calc: `Cálculos e documentação`,
          heuristicas: `Gerado via wizard em ${new Date().toISOString().split('T')[0]}`
        },
        como_quantificar: `Somar tempos de preparo + análise + corrida + cálculo`,
        status: 'criado_por_wizard'
      };
      const putRes = await fetch('/api/config/skill/tests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(existing)
      });
      if (putRes.ok) {
        onSaved(testName);
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { num: 1, label: 'Classificação' },
    { num: 2, label: 'Rotas e Tempos' },
    { num: 3, label: 'Aliases' },
    { num: 4, label: 'Revisão' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">🧪 Novo Teste</h3>
            <p className="text-xs text-slate-500 truncate">{testName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {/* Steps bar */}
        <div className="flex border-b border-slate-100">
          {steps.map(s => (
            <div key={s.num} className={`flex-1 text-center py-2 text-[10px] font-bold ${step >= s.num ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-300'}`}>
              {step > s.num ? <Check className="w-3 h-3 inline mr-0.5" /> : null}
              {s.num}. {s.label}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700">Passo 1: Classificação do Teste</h4>
              <div>
                <label className="text-xs text-slate-500 font-medium">Técnica</label>
                <select value={tecnica} onChange={e => { setTecnica(e.target.value); setRotas(suggestRoutes(e.target.value)); }}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  {TECHNIQUES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Categoria</label>
                <select value={categoria} onChange={e => setCategoria(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Forma Farmacêutica</label>
                <select value={forma} onChange={e => setForma(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700">Passo 2: Rotas e Tempos</h4>
              <p className="text-xs text-slate-400">Marque os equipamentos/funções envolvidos:</p>
              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-lg">
                {AVAILABLE_ROUTES.map(r => (
                  <button key={r} onClick={() => toggleRota(r)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${rotas.includes(r) ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}>
                    {rotas.includes(r) ? '✓ ' : ''}{r}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={customRota} onChange={e => setCustomRota(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRota()}
                  placeholder="Nova rota..."
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                <button onClick={addRota} className="px-3 py-1 bg-slate-100 rounded text-xs font-medium hover:bg-slate-200"><Plus className="w-3 h-3" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Tempo Fixo (min)</label>
                  <input type="number" value={fixoMin} onChange={e => setFixoMin(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Tempo Var (min)</label>
                  <input type="number" value={varMin} onChange={e => setVarMin(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">MO%</label>
                  <input type="number" min="0" max="100" value={moPct} onChange={e => setMoPct(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700">Passo 3: Aliases (nomes alternativos)</h4>
              <p className="text-xs text-slate-400">Adicione variações do nome em português, espanhol e inglês:</p>
              <div className="flex flex-wrap gap-1">
                {['Metais Pesados', 'Heavy Metals', 'Metales Pesados', 'Impurezas Metálicas', 'Metallic Impurities'].map(a => {
                  const active = aliases.includes(a);
                  return (
                    <button key={a} onClick={() => toggleAlias(a)}
                      className={`px-2 py-1 rounded text-[10px] font-medium ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                      {active ? '✓ ' : '+ '}{a}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1">
                <input value={customAlias} onChange={e => setCustomAlias(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAlias()}
                  placeholder="Novo alias..."
                  className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                <button onClick={addAlias} className="px-3 py-1 bg-slate-100 rounded text-xs font-medium hover:bg-slate-200"><Plus className="w-3 h-3" /></button>
              </div>
              <div>
                <label className="text-xs text-slate-500 font-medium">Descrição</label>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                  rows={2} placeholder="Breve descrição do teste..." 
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-none" />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700">Passo 4: Revisão</h4>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-xs">
                <div><span className="text-slate-400">Nome:</span> <span className="font-bold text-slate-800">{testName}</span></div>
                <div><span className="text-slate-400">Técnica:</span> {tecnica}</div>
                <div><span className="text-slate-400">Categoria:</span> {categoria} | <span className="text-slate-400">Forma:</span> {forma}</div>
                <div><span className="text-slate-400">Rotas ({rotas.length}):</span> <span className="text-indigo-600">{rotas.join(', ')}</span></div>
                <div><span className="text-slate-400">Tempos:</span> Fixo {fixoMin}min | Var {varMin}min | MO {moPct}%</div>
                <div><span className="text-slate-400">Aliases:</span> {aliases.join(', ')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
          <div>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Voltar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
            {step < 4 ? (
              <button onClick={() => setStep(s => s + 1)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1">
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar e Criar no Vault'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
