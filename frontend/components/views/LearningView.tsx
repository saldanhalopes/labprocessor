import React, { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, TestTube, CheckCircle, AlertTriangle, Lightbulb, Clock, Activity, Loader2, ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface Stats {
  totalExtractions: number;
  totalExtractedTests: number;
  totalMatchedTests: number;
  matchRate: number;
  totalStubsCreated: number;
  totalAliasesAdded: number;
  avgDurationMs: number;
  matchRateTrend: { date: string; rate: number; extracted: number; matched: number }[];
  topTests: { name: string; count: number }[];
  topTechniques: { name: string; count: number }[];
  stubGrowth: { date: string; stubs: number }[];
  lastExtraction: string | null;
}

interface PendingAlias {
  id: string;
  testName: string;
  alias: string;
  confidence: number;
  added: string;
  verified: boolean;
}

interface Pattern {
  cooccurrences: { tests: string[]; count: number; rate: number }[];
  techniqueClusters: { technique: string; tests: { name: string; count: number }[] }[];
  formTests: Record<string, { name: string; count: number; pct: number }[]>;
  topStubs: { name: string; count: number }[];
  totalExtractions: number;
  generatedAt: string;
  ready: boolean;
}

interface BiasData {
  adjustments: { testName: string; biasPct: number; direction: string; suggestedFactor: number; confidence: string; count: number; technique: string; recommendation: string }[];
  techSummary: { technique: string; avgBiasPct: number; count: number; note: string }[];
  globalAvgPct: number;
  byTest: Record<string, { avgPct: number; count: number; tech: string }>;
}

const LearningView: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingAliases, setPendingAliases] = useState<PendingAlias[]>([]);
  const [patterns, setPatterns] = useState<Pattern | null>(null);
  const [bias, setBias] = useState<BiasData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, aliasesRes, biasRes, patternsRes] = await Promise.all([
        fetch('/api/learning/stats').then(r => r.json()),
        fetch('/api/learning/pending-aliases').then(r => r.json()),
        fetch('/api/learning/bias').then(r => r.json()),
        fetch('/api/learning/patterns').then(r => r.json())
      ]);
      setStats(statsRes);
      setPendingAliases(aliasesRes);
      setBias(biasRes);
      setPatterns(patternsRes);
    } catch (e) { console.error('LearningView load error:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleVerifyAlias = async (id: string, approve: boolean) => {
    try {
      await fetch(`/api/learning/verify-alias/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve })
      });
      loadAll();
    } catch (e) { console.error('Verify alias error:', e); }
  };

  const handleConsolidate = async () => {
    try {
      await fetch('/api/learning/consolidate', { method: 'POST' });
      loadAll();
    } catch (e) { console.error('Consolidate error:', e); }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
          <Brain className="w-8 h-8 text-emerald-600" />
          Aprendizado — Segundo Cérebro
        </h2>
        <p className="text-slate-500 mt-2">
          {stats?.totalExtractions || 0} extrações processadas · O sistema aprende e melhora a cada análise
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Extrações', value: stats?.totalExtractions || 0, icon: Activity, color: 'violet' },
          { label: 'Taxa de Match', value: `${stats?.matchRate || 0}%`, icon: CheckCircle, color: 'emerald' },
          { label: 'Stubs Criados', value: stats?.totalStubsCreated || 0, icon: TestTube, color: 'amber' },
          { label: 'Aliases Aprendidos', value: stats?.totalAliasesAdded || 0, icon: Lightbulb, color: 'blue' },
        ].map(card => (
          <div key={card.label} className={`bg-${card.color}-50 border border-${card.color}-200 rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-5 h-5 text-${card.color}-500`} />
              <span className={`text-xs font-bold text-${card.color}-500 uppercase tracking-wider`}>{card.label}</span>
            </div>
            <div className={`text-3xl font-black text-${card.color}-700`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Match Rate Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Taxa de Match ao Longo do Tempo
          </h3>
          {(stats?.matchRateTrend || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats?.matchRateTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={false} name="Match Rate %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Dados insuficientes</p>
          )}
        </div>

        {/* Stub Growth */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-500" />
            Crescimento de Stubs (Acumulado)
          </h3>
          {(stats?.stubGrowth || []).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats?.stubGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="stubs" stroke="#f59e0b" strokeWidth={2} dot={false} name="Stubs" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Dados insuficientes</p>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Tests */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <TestTube className="w-4 h-4 text-violet-500" />
            Testes Mais Encontrados
          </h3>
          <div className="space-y-2">
            {(stats?.topTests || []).map((t, i) => (
              <div key={t.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                  <span className="text-sm font-medium text-slate-700">{t.name}</span>
                </div>
                <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{t.count}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bias Calibration */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Calibração de Viés
            </h3>
            {bias && (
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                Math.abs(bias.globalAvgPct) > 25 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                Global: {bias.globalAvgPct}%
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
            {(bias?.adjustments || []).slice(0, 5).map(a => (
              <div key={a.testName} className="p-3 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">{a.testName}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${a.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {a.confidence}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{a.recommendation}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span>{a.technique}</span>
                  <span>Viés: {a.biasPct}%</span>
                  <span>{a.count}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Aliases */}
      {pendingAliases.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-blue-500" />
            Aliases Aguardando Verificação
          </h3>
          <div className="space-y-3">
            {pendingAliases.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    &ldquo;{a.testName}&rdquo; ← &ldquo;{a.alias}&rdquo;
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    Confiança: {Math.round(a.confidence)}% · {new Date(a.added).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerifyAlias(a.id, true)}
                    className="p-2 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                    title="Confirmar"
                  >
                    <ThumbsUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleVerifyAlias(a.id, false)}
                    className="p-2 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                    title="Rejeitar"
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns Section */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Co-occurrences */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-pink-500" />
            Co-ocorrências
          </h3>
          {patterns?.ready && (patterns.cooccurrences || []).length > 0 ? (
            <div className="space-y-2">
              {patterns.cooccurrences.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                  <span className="text-sm text-slate-700">
                    {c.tests[0]} + {c.tests[1]}
                  </span>
                  <span className="text-xs font-bold bg-pink-100 text-pink-700 px-2 py-0.5 rounded">{c.rate}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Aguardando dados (mín. 2 extrações)</p>
          )}
        </div>

        {/* Technique Clusters + Form Tests */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-purple-500" />
            Técnicas por Teste
          </h3>
          {(patterns?.techniqueClusters || []).length > 0 ? (
            <div className="space-y-3">
              {patterns?.techniqueClusters.slice(0, 4).map((tc, i) => (
                <div key={i} className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                  <p className="text-sm font-bold text-purple-700 mb-1">{tc.technique}</p>
                  <div className="flex flex-wrap gap-1">
                    {tc.tests.map(t => (
                      <span key={t.name} className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded border border-purple-100">
                        {t.name} ({t.count}x)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Aguardando dados de técnicas</p>
          )}
        </div>
      </div>

      {/* Stubs with Potential */}
      {patterns?.ready && (patterns.topStubs || []).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TestTube className="w-4 h-4 text-amber-500" />
              Stubs com Potencial de Promoção
            </h3>
            <button
              onClick={handleConsolidate}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Consolidar Stubs
            </button>
          </div>
          <div className="space-y-2">
            {patterns.topStubs.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                <span className="text-sm text-slate-700">{s.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (s.count / 3) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-amber-600">{s.count}/3</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningView;
