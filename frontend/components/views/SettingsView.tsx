import React, { useState, useEffect } from 'react';
import { GlobalSettings, Language } from '../../types';
import { Save, Database, Trash2, Key, Workflow, ChevronDown, ChevronRight, Plus, X, Minus } from 'lucide-react';
import { translations } from '../../utils/translations';
import { useToast } from '../../context/ToastContext';
import { RotasTable } from '../settings/RotasTable';

interface SettingsViewProps {
  settings: GlobalSettings;
  onSave: (newSettings: GlobalSettings) => void;
  onClearDb: () => void;
  language: Language;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSave, onClearDb, language }) => {
  const [localSettings, setLocalSettings] = React.useState<GlobalSettings>(settings);
  const [apiKey, setApiKey] = useState('');
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [skillPrompts, setSkillPrompts] = useState<Record<string,string>>({});
  const [skillLang, setSkillLang] = useState('pt');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [testConfig, setTestConfig] = useState<Record<string,any>>({});
  const [selectedTest, setSelectedTest] = useState('');
  const [savingTest, setSavingTest] = useState(false);
  const [showDynamicGuide, setShowDynamicGuide] = useState(false);
  const [basefluxoData, setBasefluxoData] = useState<Record<string,any>>({});
  const [basefluxoText, setBasefluxoText] = useState('');
  const [savingBasefluxo, setSavingBasefluxo] = useState(false);
  const [showBasefluxo, setShowBasefluxo] = useState(false);
  const [expandedAtivos, setExpandedAtivos] = useState<Set<string>>(new Set());
  const [expandedFormas, setExpandedFormas] = useState<Set<string>>(new Set());
  const [expandedTestes, setExpandedTestes] = useState<Set<string>>(new Set());

  const buildDynamicGuide = () => {
    let guide = '## Referência de Testes Conhecidos\n\n';
    Object.entries(testConfig).forEach(([name, t]: [string, any]) => {
      if (t.status === 'stub') return;
      const aliases = (t.aliases || []).join(', ');
      const rotas = (t.rotas || []).map((r: any) => r.nome || r).filter(Boolean);
      const dirs = t.diretrizes || [];
      const fixo = dirs.reduce((s: number, d: any) => s + (Number(d.fixo_min) || 0), 0);
      const vr = dirs.reduce((s: number, d: any) => s + (Number(d.var_min) || 0), 0);
      guide += `### ${name}\n`;
      guide += `- Técnica: ${t.tecnica || '?'}\n`;
      if (aliases) guide += `- Também conhecido como: ${aliases}\n`;
      if (rotas.length) guide += `- Rotas: ${rotas.join(', ')}\n`;
      if (fixo + vr > 0) guide += `- Fixo: ${fixo}min | Var: ${vr}min\n`;
      if (dirs.length) {
        guide += '- Diretrizes:\n';
        dirs.forEach((d: any) => {
          guide += `  - **${d.componente}**: ${d.descricao || ''}`;
          if (d.heuristica) guide += ` [${d.heuristica}]`;
          guide += d.fixo_min ? ` (Fixo:${d.fixo_min}min)` : '';
          guide += d.var_min ? ` (Var:${d.var_min}min)` : '';
          guide += '\n';
        });
      }
      guide += '\n';
    });
    return guide;
  };
  const { showToast } = useToast();
  const t = translations[language].settings;

  useEffect(() => {
    fetch('/api/config/openrouter-key').then(r => r.json()).then(data => {
      setKeyConfigured(data.configured);
      if (data.configured) setApiKey('***configured***');
    }).catch(() => {});
    fetch('/api/config/skill/prompts').then(r => r.json()).then(data => {
      setSkillPrompts(data);
    }).catch(() => {});
    fetch('/api/config/skill/tests').then(r => r.json()).then(data => {
      setTestConfig(data);
      const keys = Object.keys(data);
      if (keys.length > 0) setSelectedTest(keys[0]);
    }).catch(() => {});
    fetch('/api/config/skill/basefluxo').then(r => r.json()).then(data => {
      setBasefluxoData(data);
      setBasefluxoText(JSON.stringify(data, null, 2));
    }).catch(() => {});
  }, []);

  const handleSaveBasefluxo = async () => {
    setSavingBasefluxo(true);
    try {
      const res = await fetch('/api/config/skill/basefluxo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(basefluxoData)
      });
      if (res.ok) showToast('BASEFLUXO salvo!', 'success');
      else showToast('Erro ao salvar BASEFLUXO', 'error');
    } catch { showToast('Erro de conexão', 'error'); }
    finally { setSavingBasefluxo(false); }
  };

  const bfAddAtivo = () => { const name = prompt('Nome do ativo:'); if (name) setBasefluxoData(d => ({...d, [name.toUpperCase()]: {}})); };
  const bfRemoveAtivo = (ativo: string) => { const d = {...basefluxoData}; delete d[ativo]; setBasefluxoData(d); };
  const bfAddForma = (ativo: string) => { const name = prompt('Forma farmacêutica (ex: Sólidos):'); if (name) { const d = {...basefluxoData}; d[ativo] = {...d[ativo], [name]: {}}; setBasefluxoData(d); }};
  const bfRemoveForma = (ativo: string, forma: string) => { const d = {...basefluxoData}; delete d[ativo][forma]; setBasefluxoData(d); };
  const bfAddTeste = (ativo: string, forma: string) => { const name = prompt('Nome do teste:'); if (name) { const d = {...basefluxoData}; d[ativo][forma] = {...d[ativo][forma], [name.toUpperCase()]: []}; setBasefluxoData(d); }};
  const bfRemoveTeste = (ativo: string, forma: string, teste: string) => { const d = {...basefluxoData}; delete d[ativo][forma][teste]; setBasefluxoData(d); };
  const bfAddAtividade = (ativo: string, forma: string, teste: string) => {
    const d = {...basefluxoData};
    d[ativo][forma][teste] = [...(d[ativo][forma][teste]||[]), { atividade: '', rota: '', execucao: 'MAQ', padrao_amostra: 'Padrão', tempo_corrida_minutos: 0 }];
    setBasefluxoData(d);
  };
  const bfUpdateAtividade = (ativo: string, forma: string, teste: string, idx: number, field: string, value: any) => {
    const d = {...basefluxoData};
    d[ativo][forma][teste] = [...(d[ativo][forma][teste]||[])];
    d[ativo][forma][teste][idx] = {...d[ativo][forma][teste][idx], [field]: value};
    setBasefluxoData(d);
  };
  const bfRemoveAtividade = (ativo: string, forma: string, teste: string, idx: number) => {
    const d = {...basefluxoData};
    d[ativo][forma][teste] = (d[ativo][forma][teste]||[]).filter((_: any, i: number) => i !== idx);
    setBasefluxoData(d);
  };
  const toggleExpanded = (setter: any, key: string) => setter((s: Set<string>) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      const res = await fetch('/api/config/skill/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skillPrompts)
      });
      if (res.ok) showToast('Prompt salvo com sucesso!', 'success');
      else showToast('Erro ao salvar prompt', 'error');
    } catch { showToast('Erro de conexão', 'error'); }
    finally { setSavingPrompt(false); }
  };

  const handleSaveTest = async () => {
    setSavingTest(true);
    try {
      const res = await fetch('/api/config/skill/tests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig)
      });
      if (res.ok) showToast('Testes salvos!', 'success');
      else showToast('Erro ao salvar', 'error');
    } catch { showToast('Erro de conexão', 'error'); }
    finally { setSavingTest(false); }
  };

  const updateTestField = (field: string, value: any) => {
    setTestConfig(prev => ({
      ...prev,
      [selectedTest]: { ...prev[selectedTest], [field]: value }
    }));
  };

  const handleSaveKey = async () => {
    if (!apiKey || apiKey === '***configured***') return;
    setSavingKey(true);
    try {
      const res = await fetch('/api/config/gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey })
      });
      const data = await res.json();
      if (data.success) {
        setKeyConfigured(true);
        showToast('API Key configurada com sucesso!', 'success');
      } else {
        showToast('Erro ao salvar key: ' + (data.error || ''), 'error');
      }
    } catch (err) {
      showToast('Erro de conexão', 'error');
    } finally {
      setSavingKey(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: parseFloat(value)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localSettings);
    showToast("Configurações salvas com sucesso!", "success");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      
      {/* OpenRouter API Key */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Key className="w-6 h-6 text-emerald-600" />
          <h3 className="text-xl font-bold text-slate-800">OpenRouter API Key</h3>
          {keyConfigured && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">CONFIGURADA</span>
          )}
        </div>

        <div className="flex gap-3">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={keyConfigured ? '******' : 'Cole sua chave OpenRouter aqui...'}
            className="flex-1 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-sm"
          />
          <button
            onClick={handleSaveKey}
            disabled={savingKey || !apiKey || apiKey === '***configured***'}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Key className="w-4 h-4" />
            {savingKey ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          A chave � necess�ria para analisar PDFs via OpenRouter e para o chat RAG.
          {keyConfigured && ' J� configurada.'}
        </p>
      </div>

      {/* Calculation Parameters */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-6">{t.title}</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Área do Laboratório (m²)</label>
              <input
                type="number"
                name="area"
                value={localSettings.area}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Velocidade (m/min)</label>
              <input
                type="number"
                name="velocity"
                value={localSettings.velocity}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Alpha (Trechos)</label>
              <input
                type="number"
                name="alpha"
                value={localSettings.alpha}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fator Setup (min)</label>
              <input
                type="number"
                name="setupFactor"
                value={localSettings.setupFactor}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Fator Registro (x Calc)</label>
              <input
                type="number"
                step="0.1"
                name="registerFactor"
                value={localSettings.registerFactor}
                onChange={handleChange}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Management Parameters (HH) */}
          <div className="pt-6 border-t border-slate-100 space-y-6">
            <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-widest text-xs">
              <Database className="w-4 h-4" />
              <span>Parâmetros de Gestão (Man-Hours)</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fator de Eficiência do Lab (%)</label>
                <input
                  type="number"
                  step="0.01"
                  name="labEfficiency"
                  value={localSettings.labEfficiency}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ex: 0.75 para 75%. Considera burocracia/GMP.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Jornada Diária (min)</label>
                <input
                  type="number"
                  name="dailyAvailableMinutes"
                  value={localSettings.dailyAvailableMinutes}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ex: 528 min = 8.8h de jornada.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Intervenção em Corrida (%)</label>
                <input
                  type="number"
                  step="0.01"
                  name="factorRun"
                  value={localSettings.factorRun}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ex: 0.10 para 10% de presença humana.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Intervenção em Incubação (%)</label>
                <input
                  type="number"
                  step="0.01"
                  name="factorIncubation"
                  value={localSettings.factorIncubation}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Ex: 0.02 para 2% de carga/leitura.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-700 transition-colors"
            >
              <Save className="w-5 h-5" />
              {t.saveParams}
            </button>
          </div>
        </form>
        
        <div className="mt-6 bg-slate-50 p-4 rounded-lg text-xs text-slate-500 space-y-2">
          <p className="font-semibold mb-1 uppercase tracking-wider text-[10px] text-slate-400">Fórmulas Utilizadas:</p>
          <p><strong>Locomoção:</strong> (Alpha * √Area) / Velocidade</p>
          <p><strong>Lead Time Total:</strong> Locomoção + Setup + Prep + Análise + Corrida + Calc + (Calc * FatorRegistro) + Incubação</p>
          <p><strong>HH Total:</strong> Locomoção + Setup + Prep + Análise + (Corrida * FatorCorrida) + Calc + (Calc * FatorRegistro) + (Incubação * FatorIncubação)</p>
          <p><strong>Headcount Lab:</strong> (ΣHH * 60) / (Jornada * Eficiência)</p>
        </div>
      </div>

      {/* Skill IA — Prompts and Extraction Configuration */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🧠</span>
          <h3 className="text-xl font-bold text-slate-800">Skill IA — Instruções de Extração</h3>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4 text-xs text-slate-600">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-indigo-700">⚙️ Dados da Configuração de Testes</span>
          </div>
          <p>
            Os nomes de testes, aliases, técnicas, rotas e diretrizes são <strong>auto-gerados</strong> a partir
            da <strong>Configuração de Testes</strong> abaixo. Ao editar um teste nos Parâmetros, 
            a IA automaticamente recebe as novas instruções no próximo PDF processado.
          </p>
          <p className="mt-1 text-indigo-500">
            📋 {Object.keys(testConfig).length} testes configurados alimentam o prompt da IA.
          </p>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Abaixo está o <strong>prompt base</strong> (role, objetivos, formato JSON). 
          A seção "Referência de Testes Conhecidos" é gerada automaticamente a cada chamada.
        </p>

        <div className="flex gap-2 mb-4">
          {(['pt','es','en'] as string[]).map(lang => (
            <button key={lang} onClick={() => setSkillLang(lang)}
              className={`px-3 py-1 rounded text-xs font-bold ${skillLang===lang?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        <textarea
          value={skillPrompts[skillLang] || ''}
          onChange={e => setSkillPrompts(p => ({...p, [skillLang]: e.target.value}))}
          rows={20}
          className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs resize-y"
          spellCheck={false}
        />

        <button onClick={handleSavePrompt} disabled={savingPrompt}
          className="mt-3 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
          {savingPrompt ? 'Salvando...' : 'Salvar Prompt'}
        </button>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <button onClick={() => setShowDynamicGuide(!showDynamicGuide)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
            {showDynamicGuide ? '▼' : '▶'} Pré-visualizar guia dinâmico enviado à IA
          </button>
          {showDynamicGuide && (
            <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 max-h-64 overflow-y-auto whitespace-pre-wrap">
              {buildDynamicGuide()}
            </pre>
          )}
        </div>
      </div>

      {/* Test Configuration */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">⚙️</span>
          <h3 className="text-xl font-bold text-slate-800">Configuração de Testes</h3>
          <span className="text-xs text-slate-400 ml-auto">{Object.keys(testConfig).length} testes</span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Ajuste as diretrizes de extração, aliases, rotas e tempos para cada tipo de teste. Adicione novos testes que não estão listados.
        </p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {Object.keys(testConfig).map(name => (
            <button key={name} onClick={() => setSelectedTest(name)}
              className={`px-3 py-1 rounded text-xs font-bold ${selectedTest===name?'bg-indigo-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {name}
            </button>
          ))}
          <button onClick={() => {
            const name = prompt('Nome do novo teste:');
            if (name) { setTestConfig(prev => ({...prev, [name]: {tecnica:'',categoria:'',descricao:'',rotas:[],como_quantificar:'',mo_pct:0,aliases:[],status:'stub'}})); setSelectedTest(name); }
          }} className="px-3 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
            + Novo
          </button>
        </div>

        {selectedTest && testConfig[selectedTest] && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-500 font-medium block mb-0.5">Técnica</label>
                <input value={testConfig[selectedTest].tecnica||''} onChange={e=>updateTestField('tecnica',e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-0.5">Categoria</label>
                <input value={testConfig[selectedTest].categoria||''} onChange={e=>updateTestField('categoria',e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-slate-500 font-medium block mb-0.5">MO%</label>
                <input type="number" value={testConfig[selectedTest].mo_pct||0} onChange={e=>updateTestField('mo_pct',Number(e.target.value))}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="text-slate-500 font-medium block mb-0.5">Descrição</label>
              <textarea value={testConfig[selectedTest].descricao||''} onChange={e=>updateTestField('descricao',e.target.value)}
                rows={2} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-y" />
            </div>
            <div>
              <label className="text-slate-500 font-medium block mb-0.5">Aliases (separados por vírgula)</label>
              <input value={(testConfig[selectedTest].aliases||[]).join(', ')} onChange={e=>updateTestField('aliases',e.target.value.split(',').map(s=>s.trim()).filter(Boolean))}
                className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-mono" />
            </div>
            <div>
              <label className="text-slate-500 font-medium block mb-0.5">Rotas</label>
              <RotasTable
                rotas={(testConfig[selectedTest].rotas || []).map((r: any) => typeof r === 'string' ? { nome: r, tipo: 'Máquina', execucao: 'MAQ', descricao: '', diretrizes: [] } : r)}
                onChange={(r: any) => updateTestField('rotas', r)}
              />
            </div>
            <div>
              <label className="text-slate-500 font-medium block mb-0.5">Como Quantificar</label>
              <textarea value={testConfig[selectedTest].como_quantificar||''} onChange={e=>updateTestField('como_quantificar',e.target.value)}
                rows={2} className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 resize-y" />
            </div>
            <button onClick={handleSaveTest} disabled={savingTest}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {savingTest ? 'Salvando...' : 'Salvar Testes'}
            </button>
          </div>
        )}
      </div>

      {/* BASEFLUXO Editor */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Workflow className="w-6 h-6 text-teal-600" />
          <h3 className="text-xl font-bold text-slate-800">BASEFLUXO — Fluxo de CQ</h3>
          <span className="text-xs text-slate-400 ml-auto">
            {Object.keys(basefluxoData).filter(k => !['FORMA FARMACÊUTICA'].includes(k)).length} ativos
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Gerencie o fluxo de CQ por ativo, forma farmacêutica, teste e atividades.
        </p>

        <button onClick={bfAddAtivo}
          className="mb-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Novo Ativo
        </button>

        <div className="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar">
          {Object.entries(basefluxoData)
            .filter(([k]) => !['FORMA FARMACÊUTICA'].includes(k))
            .map(([ativo, formas]: [string, any]) => {
              const isAtivoOpen = expandedAtivos.has(ativo);
              const formaKeys = Object.keys(formas||{});
              const totalTestes = formaKeys.reduce((s: number, f: string) => s + Object.keys(formas[f]||{}).length, 0);
              return (
                <div key={ativo} className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* ATIVO header */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                    onClick={() => toggleExpanded(setExpandedAtivos, ativo)}>
                    <div className="flex items-center gap-2">
                      {isAtivoOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <span className="font-bold text-slate-700">{ativo}</span>
                      <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded">{formaKeys.length} formas · {totalTestes} testes</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); bfRemoveAtivo(ativo); }}
                      className="p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </div>

                  {isAtivoOpen && (
                    <div className="border-t border-slate-100">
                      <div className="p-2">
                        <button onClick={e => { e.stopPropagation(); bfAddForma(ativo); }}
                          className="px-3 py-1 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-lg flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Forma
                        </button>
                      </div>
                      {formaKeys.map(forma => {
                        const isFormaOpen = expandedFormas.has(`${ativo}/${forma}`);
                        const testes = formas[forma] || {};
                        return (
                          <div key={forma} className="border-t border-slate-100">
                            {/* FORMA header */}
                            <div className="flex items-center justify-between px-5 py-2 hover:bg-slate-50 cursor-pointer"
                              onClick={e => { e.stopPropagation(); toggleExpanded(setExpandedFormas, `${ativo}/${forma}`); }}>
                              <div className="flex items-center gap-2">
                                {isFormaOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                <span className="text-sm font-semibold text-slate-600">{forma}</span>
                                <span className="text-[10px] text-slate-400">{Object.keys(testes).length} testes</span>
                              </div>
                              <button onClick={e => { e.stopPropagation(); bfRemoveForma(ativo, forma); }}
                                className="p-0.5 rounded hover:bg-red-100 text-red-400"><X className="w-3 h-3" /></button>
                            </div>

                            {isFormaOpen && (
                              <div className="pl-8 pr-4 pb-2">
                                <button onClick={e => { e.stopPropagation(); bfAddTeste(ativo, forma); }}
                                  className="px-3 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1 mb-2">
                                  <Plus className="w-3 h-3" /> Teste
                                </button>
                                {Object.entries(testes).map(([teste, atividades]: [string, any]) => {
                                  const isTesteOpen = expandedTestes.has(`${ativo}/${forma}/${teste}`);
                                  return (
                                    <div key={teste} className="mb-2 border border-slate-100 rounded-lg overflow-hidden">
                                      {/* TESTE header */}
                                      <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/50 cursor-pointer"
                                        onClick={() => toggleExpanded(setExpandedTestes, `${ativo}/${forma}/${teste}`)}>
                                        <div className="flex items-center gap-1.5">
                                          {isTesteOpen ? <ChevronDown className="w-3 h-3 text-indigo-400" /> : <ChevronRight className="w-3 h-3 text-indigo-400" />}
                                          <span className="text-xs font-bold text-indigo-700">{teste}</span>
                                          <span className="text-[10px] text-indigo-400">{(atividades||[]).length} atividades</span>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); bfRemoveTeste(ativo, forma, teste); }}
                                          className="p-0.5 rounded hover:bg-red-100 text-red-400"><X className="w-3 h-3" /></button>
                                      </div>

                                      {isTesteOpen && (
                                        <div className="p-2">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="text-slate-500 border-b border-slate-100">
                                                <th className="text-left py-1 font-medium">Atividade</th>
                                                <th className="text-left py-1 font-medium">Rota</th>
                                                <th className="text-left py-1 font-medium w-16">Exec</th>
                                                <th className="text-left py-1 font-medium w-20">Padrão/Amostra</th>
                                                <th className="text-right py-1 font-medium w-20">Tempo (min)</th>
                                                <th className="w-8"></th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {(atividades||[]).map((a: any, i: number) => (
                                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                                  <td className="py-1 pr-1">
                                                    <input value={a.atividade} onChange={e => bfUpdateAtividade(ativo, forma, teste, i, 'atividade', e.target.value)}
                                                      className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-teal-300" />
                                                  </td>
                                                  <td className="py-1 pr-1">
                                                    <input value={a.rota} onChange={e => bfUpdateAtividade(ativo, forma, teste, i, 'rota', e.target.value)}
                                                      className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-teal-300" />
                                                  </td>
                                                  <td className="py-1 pr-1">
                                                    <select value={a.execucao} onChange={e => bfUpdateAtividade(ativo, forma, teste, i, 'execucao', e.target.value)}
                                                      className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs outline-none">
                                                      <option value="MO">MO</option>
                                                      <option value="MAQ">MAQ</option>
                                                    </select>
                                                  </td>
                                                  <td className="py-1 pr-1">
                                                    <select value={a.padrao_amostra} onChange={e => bfUpdateAtividade(ativo, forma, teste, i, 'padrao_amostra', e.target.value)}
                                                      className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs outline-none">
                                                      <option value="Padrão">Padrão</option>
                                                      <option value="Amostra">Amostra</option>
                                                    </select>
                                                  </td>
                                                  <td className="py-1 pr-1">
                                                    <input type="number" value={a.tempo_corrida_minutos} onChange={e => bfUpdateAtividade(ativo, forma, teste, i, 'tempo_corrida_minutos', parseFloat(e.target.value)||0)}
                                                      className="w-full px-1 py-0.5 border border-slate-200 rounded text-xs text-right outline-none focus:ring-1 focus:ring-teal-300" />
                                                  </td>
                                                  <td className="py-1 text-center">
                                                    <button onClick={() => bfRemoveAtividade(ativo, forma, teste, i)}
                                                      className="p-0.5 rounded hover:bg-red-100 text-red-400"><Minus className="w-3 h-3" /></button>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                          <button onClick={() => bfAddAtividade(ativo, forma, teste)}
                                            className="mt-2 px-3 py-1 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-lg flex items-center gap-1">
                                            <Plus className="w-3 h-3" /> Atividade
                                          </button>
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
                  )}
                </div>
              );
            })}
        </div>

        <button onClick={handleSaveBasefluxo} disabled={savingBasefluxo}
          className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
          {savingBasefluxo ? 'Salvando...' : 'Salvar BASEFLUXO'}
        </button>
      </div>

      {/* Database Management */}
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-teal-600" />
          <h3 className="text-xl font-bold text-slate-800">{t.dbTitle}</h3>
        </div>
        
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-800">Limpar Banco de Dados Local</p>
            <p className="text-xs text-red-600">Isso removerá todos os métodos carregados permanentemente.</p>
          </div>
          <button
            onClick={onClearDb}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            {t.clearDb}
          </button>
        </div>
      </div>

    </div>
  );
};
