import React, { useEffect, useMemo, useState } from 'react';
import type { EtapaBasfluxo } from '../../types';
import { buildRouteTree } from '../../services/routeTree';
import { RouteTreeDiagram } from './RouteTreeDiagram';
import { RouteTreeMiniMap } from './RouteTreeMiniMap';
import type { LabLayout } from '../../services/layoutTypes';

interface Props {
  etapas: EtapaBasfluxo[];
  testName: string;
}

function formatExecucao(execucao: string | null | undefined): string {
  return execucao === 'MO' ? 'Analista (MO)' : execucao === 'MAQ' ? 'Maquina (MAQ)' : 'N/A';
}

export const RouteTreeWorkspace: React.FC<Props> = ({ etapas, testName }) => {
  const [layout, setLayout] = useState<LabLayout | null>(null);
  const [layoutWarning, setLayoutWarning] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [mode, setMode] = useState<'structure' | 'gargalo' | 'layout'>('structure');

  const model = useMemo(() => buildRouteTree(etapas, testName), [etapas, testName]);
  const nodeMap = useMemo(() => Object.fromEntries(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const selectedNode = selectedNodeId ? nodeMap[selectedNodeId] : null;
  const selectedStage = selectedStageId ? model.stages.find((stage) => stage.id === selectedStageId) || null : null;

  useEffect(() => {
    fetch('/api/config/layout')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setLayout(data);
        setLayoutWarning(null);
      })
      .catch((error: Error) => {
        setLayoutWarning(error.message);
      });
  }, []);

  useEffect(() => {
    const firstActivity = model.nodes.find((node) => node.kind === 'activity');
    setSelectedNodeId(firstActivity?.id || null);
    setSelectedRoute(firstActivity?.rota || null);
    setSelectedStageId(firstActivity?.stageId || null);
  }, [model.nodes]);

  const focusRoute = (rota: string) => {
    const node = model.nodes.find((item) => item.rota === rota);
    if (!node) return;
    setSelectedRoute(rota);
    setSelectedNodeId(node.id);
    setSelectedStageId(node.stageId || null);
  };

  const focusNode = (nodeId: string) => {
    const node = nodeMap[nodeId];
    if (!node) return;
    setSelectedNodeId(nodeId);
    setSelectedStageId(node.stageId || null);
    if (node.rota) setSelectedRoute(node.rota);
  };

  const detailNodeIds = selectedStage?.nodeIds || [];
  const detailNodes = detailNodeIds.map((id) => nodeMap[id]).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Tempo total" value={`${model.metrics.totalMin} min`} />
        <KpiCard label="Tempo MO" value={`${model.metrics.moMin} min`} />
        <KpiCard label="Tempo MAQ" value={`${model.metrics.maqMin} min`} />
        <KpiCard label="Rotas" value={String(model.metrics.uniqueRoutes)} />
        <KpiCard label="Trocas" value={String(model.metrics.handoffs)} />
        <KpiCard label="Gargalo" value={model.metrics.bottleneckRoute || 'N/A'} />
        <KpiCard label="Economia" value={`${model.metrics.parallelSavingsMin} min`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          ['structure', 'Estrutura'],
          ['gargalo', 'Gargalo'],
          ['layout', 'Layout'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id as 'structure' | 'gargalo' | 'layout')}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              mode === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
        {layoutWarning && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            Layout indisponivel: {layoutWarning}
          </span>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]">
        <RouteTreeDiagram
          model={model}
          layout={layout}
          mode={mode}
          selectedNodeId={selectedNodeId}
          selectedStageId={selectedStageId}
          hoveredNodeId={hoveredNodeId}
          selectedRoute={selectedRoute}
          onNodeHover={(nodeId) => {
            setHoveredNodeId(nodeId);
            const node = nodeId ? nodeMap[nodeId] : null;
            if (node?.rota) setSelectedRoute(node.rota);
          }}
          onNodeSelect={focusNode}
          onStageSelect={(stageId) => {
            setSelectedStageId(stageId);
            const stage = model.stages.find((item) => item.id === stageId);
            const firstNodeId = stage?.nodeIds[0];
            if (firstNodeId) focusNode(firstNodeId);
          }}
        />
        <RouteTreeMiniMap model={model} layout={layout} selectedRoute={selectedRoute} mode={mode} onRouteSelect={focusRoute} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-bold text-slate-800">Detalhes</h4>
        {selectedStage ? (
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{selectedStage.nome}</span>
              <span className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-600">{selectedStage.modo}</span>
              <span className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-600">{selectedStage.effectiveMin} min efetivos</span>
              {selectedStage.parallelSavingsMin > 0 && (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  economia {selectedStage.parallelSavingsMin} min
                </span>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {detailNodes.map((node) => (
                <div key={node.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-bold text-slate-800">{node.rota}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatExecucao(node.execucao)} · {node.totalMin} min</div>
                  <div className="mt-2 text-xs text-slate-600">{node.atividadeLabels.join(' | ')}</div>
                </div>
              ))}
            </div>
          </div>
        ) : selectedNode ? (
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div className="text-base font-bold text-slate-800">{selectedNode.rota || selectedNode.atividadeLabels[0]}</div>
            <div className="text-xs text-slate-500">
              {formatExecucao(selectedNode.execucao)} · {selectedNode.totalMin} min
              {selectedNode.stageName ? ` · etapa ${selectedNode.stageName}` : ''}
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              {selectedNode.atividadeLabels.join(' | ')}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Selecione um no, etapa ou rota no mini mapa para ver contexto.</p>
        )}
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
  </div>
);

