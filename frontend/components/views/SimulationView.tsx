import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, RotateCcw, Clock, Activity, AlertTriangle, Users, Boxes, Layers, ChevronRight, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { SimulationCanvas, type SimulationCanvasHandle } from '../simulation/SimulationCanvas';
import { simulateFIFO } from '../../services/scheduler';
import type { AnalysisResult, GlobalSettings, Language } from '../../types';
import type { LabLayout } from '../../services/layoutTypes';
import type { AgentState } from '../simulation/agents';
import type { SimulationResult, ResourceUtil } from '../../services/scheduler';

interface Props {
  results: AnalysisResult[];
  settings: GlobalSettings;
  language: Language;
}

const LABELS = {
  pt: {
    title: 'Simulação 2D do Fluxo do Laboratório',
    subtitle: 'Selecione produtos e lotes. O scheduler FIFO simula o fluxo paralelo entre recursos compartilhados.',
    selecionarProdutos: 'Selecionar Produtos',
    lotes: 'Lotes',
    iniciar: 'Iniciar Simulação',
    recarregar: 'Recarregar',
    nenhumProduto: 'Nenhum produto selecionado. Selecione ao menos um.',
    semBasfluxo: 'Produto sem dados de basfluxo. Faça upload/analise primero ou use o Basfluxo.',
    kpis: 'KPIs',
    makespan: 'Makespan (tempo total)',
    tarefasTotal: 'Tarefas Totais',
    lotesSimulados: 'Lotes Simulados',
    recursos: 'Recursos',
    rota: 'Rota',
    util: 'Utilização %',
    ocupado: 'Ocupado (min)',
    ocioso: 'Ocioso (min)',
    atend: 'Atendimentos',
    gargalo: 'Gargalo detectado',
    produtos: 'Produtos Simulados',
    produto: 'Produto',
    tempoTotal: 'Tempo Total (min)',
    agenteSel: 'Agente Selecionado',
    semSelecao: 'Clique em uma amostra no canvas para ver detalhes.',
    estado: 'Estado',
    rotaAtual: 'Rota atual',
    atividade: 'Atividade atual',
    teste: 'Teste',
    lote: 'Lote',
    produtosZerados: 'Aguardando seleção de produtos',
  },
  es: {
    title: 'Simulación 2D del Flujo del Laboratorio',
    subtitle: 'Seleccione productos y lotes. El scheduler FIFO simula el flujo paralelo entre recursos compartidos.',
    selecionarProdutos: 'Seleccionar Productos',
    lotes: 'Lotes',
    iniciar: 'Iniciar Simulación',
    recarregar: 'Recargar',
    nenhumProduto: 'Ningún producto seleccionado. Seleccione al menos uno.',
    semBasfluxo: 'Producto sin datos de basfluxo. Suba/analice primero o use el Basfluxo.',
    kpis: 'KPIs',
    makespan: 'Makespan (tiempo total)',
    tarefasTotal: 'Tareas Totales',
    lotesSimulados: 'Lotes Simulados',
    recursos: 'Recursos',
    rota: 'Ruta',
    util: 'Utilización %',
    ocupado: 'Ocupado (min)',
    ocioso: 'Ocioso (min)',
    atend: 'Atenciones',
    gargalo: 'Cuello de botella detectado',
    produtos: 'Productos Simulados',
    produto: 'Producto',
    tempoTotal: 'Tiempo Total (min)',
    agenteSel: 'Agente Seleccionado',
    semSelecao: 'Haga clic en una muestra en el canvas para ver detalles.',
    estado: 'Estado',
    rotaAtual: 'Ruta actual',
    atividade: 'Actividad actual',
    teste: 'Test',
    lote: 'Lote',
    produtosZerados: 'Esperando selección de productos',
  },
  en: {
    title: '2D Lab Flow Simulation',
    subtitle: 'Select products and lots. The FIFO scheduler simulates the parallel flow across shared resources.',
    selecionarProdutos: 'Select Products',
    lotes: 'Lots',
    iniciar: 'Start Simulation',
    recarregar: 'Reload',
    nenhumProduto: 'No product selected. Choose at least one.',
    semBasfluxo: 'Product without basfluxo data. Upload/analyze first or use Basfluxo.',
    kpis: 'KPIs',
    makespan: 'Makespan (total time)',
    tarefasTotal: 'Total Tasks',
    lotesSimulados: 'Simulated Lots',
    recursos: 'Resources',
    rota: 'Route',
    util: 'Utilization %',
    ocupado: 'Busy (min)',
    ocioso: 'Idle (min)',
    atend: 'Servings',
    gargalo: 'Bottleneck detected',
    produtos: 'Simulated Products',
    produto: 'Product',
    tempoTotal: 'Total Time (min)',
    agenteSel: 'Selected Agent',
    semSelecao: 'Click a sample on the canvas to see details.',
    estado: 'State',
    rotaAtual: 'Current route',
    atividade: 'Current activity',
    teste: 'Test',
    lote: 'Lot',
    produtosZerados: 'Waiting for product selection',
  },
};

function formatMin(total: number): string {
  const d = Math.floor(total / (60 * 24));
  const h = Math.floor((total % (60 * 24)) / 60);
  const m = Math.floor(total % 60);
  if (d > 0) return `${d}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const hasBasfluxo = (r: AnalysisResult): boolean => {
  const ts = r.basfluxo?.testes || [];
  return ts.some((t: any) => (t.atividades || []).length > 0);
};

export const SimulationView: React.FC<Props> = ({ results, settings, language }) => {
  const L = LABELS[language] || LABELS.pt;
  const { showToast } = useToast();

  const [layout, setLayout] = useState<LabLayout | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [lotesMap, setLotesMap] = useState<Record<string, number>>({});
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [speed, setSpeed] = useState(10);
  const [selectedAgent, setSelectedAgent] = useState<AgentState | null>(null);
  const canvasHandle = useRef<SimulationCanvasHandle | null>(null);

  const fetchLayout = useCallback(() => {
    const n = retryCountRef.current + 1;
    retryCountRef.current = n;
    fetch('/api/config/layout')
      .then((r) => {
        if (r.ok) return r.json();
        throw new Error(`HTTP ${r.status}`);
      })
      .then((data) => { setLayout(data); setLayoutError(null); })
      .catch((e) => {
        setLayoutError(e.message);
        if (n < 3) showToast('Falha ao carregar layout. Tentando novamente...', 'warning');
        else showToast(`Erro ao carregar layout (após ${n} tentativas): ${e.message}`, 'error');
      });
  }, [showToast]);

  useEffect(() => { fetchLayout(); }, []);

  const eligible = useMemo(() => results.filter(hasBasfluxo), [results]);

  useEffect(() => {
    const m: Record<string, boolean> = {};
    for (const r of eligible) m[r.fileId] = false;
    setSelected(m);
    const l: Record<string, number> = {};
    for (const r of eligible) l[r.fileId] = 1;
    setLotesMap(l);
  }, [eligible]);

  const selectedProducts = useMemo(() => eligible.filter((r) => selected[r.fileId]), [eligible, selected]);

  const runSimulation = () => {
    if (selectedProducts.length === 0) {
      showToast(L.nenhumProduto, 'warning');
      return;
    }
    if (!layout) {
      showToast('Layout não carregado', 'error');
      return;
    }
    try {
      const lotesPorProduto: Record<string, number> = {};
      for (const p of selectedProducts) lotesPorProduto[p.fileId] = Math.max(1, lotesMap[p.fileId] || 1);
      const result = simulateFIFO({ products: selectedProducts, lotesPorProduto, settings, layout });
      setSim(result);
      setTiempo(0);
      setPlaying(false);
      canvasHandle.current?.reset();
      showToast(`Simulação gerada: ${result.totalTasks} tarefas, makespan ${formatMin(result.makespan_min)}`, 'success');
    } catch (e: any) {
      showToast(`Erro no scheduler: ${e.message}`, 'error');
    }
  };

  const reset = () => {
    setSim(null);
    setTiempo(0);
    setPlaying(false);
    setSelectedAgent(null);
  };

  if (!layout) {
    return (
      <div style={{ padding: '32px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>{L.title}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 60, textAlign: 'center' }}>
          <AlertTriangle size={40} style={{ color: '#f59e0b' }} />
          <p style={{ color: '#64748b', fontSize: 14 }}>{layoutError ? `Erro: ${layoutError}` : 'Carregando layout do laboratório...'}</p>
          {layoutError && retryCountRef.current >= 3 && (
            <button
              onClick={fetchLayout}
              style={{ padding: '8px 16px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <RotateCcw size={14} style={{ display: 'inline', marginRight: 6 }} />Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>{L.title}</h2>
      <p style={{ color: '#64748b', marginTop: 4, marginBottom: 24 }}>{L.subtitle}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <aside style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, height: 'fit-content' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 0 }}>
            <Layers size={16} /> {L.selecionarProdutos}
          </h3>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {eligible.length} elegíveis de {results.length} resultados · {results.length - eligible.length} sem basfluxo
          </div>
          {eligible.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>{L.semBasfluxo}</div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {eligible.map((r) => (
                <div key={r.fileId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: `1px solid ${selected[r.fileId] ? '#1e40af' : '#e2e8f0'}`, borderRadius: 6, background: selected[r.fileId] ? '#eff6ff' : '#f8fafc' }}>
                  <input
                    type="checkbox"
                    checked={!!selected[r.fileId]}
                    onChange={(e) => setSelected((p) => ({ ...p, [r.fileId]: e.target.checked }))}
                  />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product.productName}</span>
                  <label style={{ fontSize: 10, color: '#64748b' }}>{L.lotes}:</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={lotesMap[r.fileId] ?? 1}
                    disabled={!selected[r.fileId]}
                    onChange={(e) => setLotesMap((p) => ({ ...p, [r.fileId]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }))}
                    style={{ width: 48, padding: '2px 4px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 4 }}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            <button
              onClick={() => {
                if (!sim) return;
                setPlaying((p) => {
                  if (p) canvasHandle.current?.pause();
                  else canvasHandle.current?.play();
                  return !p;
                });
              }}
              disabled={!sim}
              style={primaryBtnStyle(!sim)}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? 'Pausar' : L.iniciar}
            </button>
            <button onClick={runSimulation} style={secondaryBtnStyle()}>
              {L.recarregar}
            </button>
            {sim && (
              <button onClick={reset} style={secondaryBtnStyle()}>
                <RotateCcw size={14} />
              </button>
            )}
          </div>
          {!sim && selectedProducts.length === 0 && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>{L.produtosZerados}.</div>
          )}
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SimulationCanvas
                ref={canvasHandle}
                sim={sim}
                layout={layout}
                tiempo_min={tiempo}
                onTiempoChange={setTiempo}
                playing={playing}
                onPlayingChange={setPlaying}
                speed={speed}
                onSpeedChange={setSpeed}
                onAgentSelect={setSelectedAgent}
                onLayoutChange={(updated) => setLayout(updated)}
              />

              {sim && (
                <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                <KPI icon={<Clock size={14} />} label={L.makespan} value={formatMin(sim.makespan_min)} />
                <KPI icon={<Activity size={14} />} label={L.tarefasTotal} value={String(sim.totalTasks)} />
                <KPI icon={<Boxes size={14} />} label={L.lotesSimulados} value={String(sim.lotesSimulados)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginTop: 4 }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 0 }}>
                    <Users size={14} /> {L.recursos}
                  </h4>
                  <table style={{ width: '100%', fontSize: 12, marginTop: 8, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '4px 8px' }}>{L.rota}</th>
                        <th style={{ padding: '4px 8px' }}>{L.util}</th>
                        <th style={{ padding: '4px 8px' }}>{L.ocupado}</th>
                        <th style={{ padding: '4px 8px' }}>{L.ocioso}</th>
                        <th style={{ padding: '4px 8px' }}>{L.atend}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.resources
                        .slice()
                        .sort((a: ResourceUtil, b: ResourceUtil) => b.utilization_pct - a.utilization_pct)
                        .map((r: ResourceUtil) => {
                          const isGargalo = r.utilization_pct > 70;
                          return (
                            <tr key={r.rota} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '5px 8px', color: isGargalo ? '#dc2626' : '#1e293b', fontWeight: isGargalo ? 600 : 400 }}>
                                {isGargalo && <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4, color: '#dc2626' }} />}
                                {r.rota}
                              </td>
                              <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{r.utilization_pct.toFixed(1)}%</td>
                              <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{formatMin(r.totalBusy_min)}</td>
                              <td style={{ padding: '5px 8px', fontFamily: 'monospace', color: '#94a3b8' }}>{formatMin(r.totalIdle_min)}</td>
                              <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{r.numAtendimentos}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 0 }}>{L.agenteSel}</h4>
                  {selectedAgent ? (
                    <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: 8 }}>
                      <Detalhe label={L.produto} value={selectedAgent.produtoName} />
                      <Detalhe label={L.teste} value={selectedAgent.testeName} />
                      <Detalhe label={L.lote} value={String(selectedAgent.lote)} />
                      <Detalhe label={L.estado} value={selectedAgent.state} />
                      <Detalhe label={L.rotaAtual} value={selectedAgent.rotaAtual || '—'} />
                      <Detalhe label={L.atividade} value={selectedAgent.descricaoAtual || '—'} />
                      {selectedAgent.execucaoAtual && (
                        <Detalhe
                          label="Execução"
                          value={`${selectedAgent.execucaoAtual === 'MAQ' ? 'Máquina' : 'Analista'} (${selectedAgent.execucaoAtual})`}
                        />
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{L.semSelecao}</div>
                  )}
                </div>
              </div>

              {sim.produtos.length > 0 && (
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 4 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 0 }}>{L.produtos}</h4>
                  <table style={{ width: '100%', fontSize: 12, marginTop: 8, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '4px 8px' }}>{L.produto}</th>
                        <th style={{ padding: '4px 8px' }}>{L.lotes}</th>
                        <th style={{ padding: '4px 8px' }}>{L.tempoTotal}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sim.produtos.map((p) => (
                        <tr key={p.produtoId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '5px 8px' }}>{p.produtoName}</td>
                          <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{p.lotes}</td>
                          <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{formatMin(p.tempoTotal_min)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sim && (
                <EventLog
                  sim={sim}
                  tiempo={tiempo}
                  playing={playing}
                  formatMin={formatMin}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const KPI: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 11, fontWeight: 600 }}>
      {icon} {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: 4 }}>{value}</div>
  </div>
);

const Detalhe: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', gap: 8 }}>
    <span style={{ color: '#64748b', flex: '0 0 96px' }}>{label}:</span>
    <span style={{ color: '#0f172a', fontWeight: 500 }}>{value}</span>
  </div>
);

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, fontWeight: 500,
  border: '1px solid #1e40af', background: disabled ? '#94a3b8' : '#1e40af', color: 'white', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
});
const secondaryBtnStyle = (): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, fontWeight: 500,
  border: '1px solid #cbd5e1', background: '#ffffff', color: '#1e293b', borderRadius: 6, cursor: 'pointer',
});

const EventLog: React.FC<{
  sim: SimulationResult;
  tiempo: number;
  playing: boolean;
  formatMin: (m: number) => string;
}> = React.memo(({ sim, tiempo, playing, formatMin }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleEvents = useMemo(
    () => sim.events.filter((e) => e.time_min <= tiempo).slice(-50),
    [sim.events, tiempo]
  );

  useEffect(() => {
    if (scrollRef.current && playing) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleEvents.length, playing]);

  const primeiraTarefa = sim.tasks.length ? sim.tasks[0].start_min : 0;

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Activity size={14} /> Log de Eventos da Simulação
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, flex: 1, textAlign: 'right' }}>
          {visibleEvents.length} de {sim.events.length} eventos
        </span>
      </h4>
      <div
        ref={scrollRef}
        style={{ maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}
      >
        {visibleEvents.length === 0 && (
          <div style={{ color: '#94a3b8' }}>
            Aguardando início... (tempo inicial: {formatMin(primeiraTarefa)})
          </div>
        )}
        {visibleEvents.map((e, i) => {
          const isStart = e.type === 'start';
          const color = isStart ? '#16a34a' : '#dc2626';
          const icon = isStart ? '▶' : '■';
          const nome = e.produtoName.length > 18 ? e.produtoName.slice(0, 18) + '…' : e.produtoName;
          return (
            <div key={`${e.taskId}-${e.type}-${i}`} style={{ color: '#1e293b', paddingLeft: 4, borderLeft: `2px solid ${color}` }}>
              <span style={{ color: '#64748b' }}>[{formatMin(e.time_min)}]</span>{' '}
              <span style={{ color }}>{icon}</span>{' '}
              <b>{nome}</b> · lote {e.lote}{' '}
              {isStart ? (
                <span style={{ color: '#1e40af' }}>iniciou em {e.rota}</span>
              ) : (
                <span style={{ color: '#64748b' }}>concluiu {e.rota}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});