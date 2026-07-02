import React, { useMemo } from 'react';
import type { RouteTreeModel, RouteTreeNode } from '../../services/routeTree';
import { getBottleneckStyles, getNodeFill, getRotaColor } from './routeVisuals';
import type { LabLayout } from '../../services/layoutTypes';

interface Props {
  model: RouteTreeModel;
  layout?: LabLayout | null;
  mode: 'structure' | 'gargalo' | 'layout';
  selectedNodeId: string | null;
  selectedStageId: string | null;
  hoveredNodeId: string | null;
  selectedRoute: string | null;
  onNodeHover: (nodeId: string | null) => void;
  onNodeSelect: (nodeId: string) => void;
  onStageSelect: (stageId: string) => void;
}

const NODE_W = 170;
const NODE_H = 62;

function pathForEdge(from: RouteTreeNode, to: RouteTreeNode): string {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export const RouteTreeDiagram: React.FC<Props> = ({
  model,
  layout,
  mode,
  selectedNodeId,
  selectedStageId,
  hoveredNodeId,
  selectedRoute,
  onNodeHover,
  onNodeSelect,
  onStageSelect,
}) => {
  const nodeMap = useMemo(() => Object.fromEntries(model.nodes.map((node) => [node.id, node])), [model.nodes]);

  const highlightedPathIds = useMemo(() => {
    const ids = new Set<string>();
    const activeNodeId = hoveredNodeId || selectedNodeId;
    if (!activeNodeId) return ids;
    let current = activeNodeId;
    while (current) {
      ids.add(current);
      const parentEdge = model.edges.find((edge) => edge.to === current);
      if (!parentEdge) break;
      ids.add(parentEdge.id);
      current = parentEdge.from;
    }
    return ids;
  }, [hoveredNodeId, selectedNodeId, model.edges]);

  const width = Math.max(900, ...model.nodes.map((node) => node.x + NODE_W + 100));
  const height = Math.max(420, ...model.nodes.map((node) => node.y + NODE_H + 120));

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <marker id="route-tree-arrow" markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6 Z" fill="#94a3b8" />
          </marker>
          <filter id="route-tree-shadow">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodOpacity="0.10" />
          </filter>
        </defs>

        {model.stages.map((stage) => {
          const stageNodes = stage.nodeIds.map((id) => nodeMap[id]).filter(Boolean);
          if (stageNodes.length === 0) return null;
          const minX = Math.min(...stageNodes.map((node) => node.x)) - 18;
          const minY = Math.min(...stageNodes.map((node) => node.y)) - 42;
          const maxX = Math.max(...stageNodes.map((node) => node.x + NODE_W)) + 18;
          const maxY = Math.max(...stageNodes.map((node) => node.y + NODE_H)) + 18;
          const selected = selectedStageId === stage.id;
          const stroke = stage.modo === 'paralelo' ? '#f59e0b' : '#0f766e';
          const fill = stage.modo === 'paralelo' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(13, 148, 136, 0.06)';
          return (
            <g key={stage.id} onClick={() => onStageSelect(stage.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={minX}
                y={minY}
                width={maxX - minX}
                height={maxY - minY}
                rx={18}
                fill={fill}
                stroke={stroke}
                strokeWidth={selected ? 2.5 : 1.2}
                strokeDasharray={stage.modo === 'paralelo' ? '6 5' : undefined}
              />
              <text x={minX + 14} y={minY + 18} fontSize="12" fontWeight="700" fill="#0f172a">
                {stage.nome}
              </text>
              <text x={minX + 14} y={minY + 34} fontSize="10" fill="#64748b">
                {stage.modo === 'paralelo' ? 'Paralelo' : 'Sequencial'} · {stage.effectiveMin} min
                {stage.parallelSavingsMin > 0 ? ` · economia ${stage.parallelSavingsMin} min` : ''}
              </text>
            </g>
          );
        })}

        {model.edges.map((edge) => {
          const from = nodeMap[edge.from];
          const to = nodeMap[edge.to];
          if (!from || !to) return null;
          const highlighted = highlightedPathIds.has(edge.id);
          const dimmed = mode === 'gargalo' && !edge.isCritical;
          return (
            <g key={edge.id}>
              <path
                d={pathForEdge(from, to)}
                fill="none"
                stroke={edge.isCritical ? '#dc2626' : '#94a3b8'}
                strokeWidth={highlighted ? 3 : edge.isCritical ? 2.5 : 1.8}
                strokeOpacity={dimmed ? 0.2 : highlighted ? 0.95 : 0.75}
                strokeDasharray={edge.sampleMin > 0 && edge.standardMin === 0 ? '5 4' : undefined}
                markerEnd="url(#route-tree-arrow)"
              >
                <title>{`${from.rota || 'Entrada'} -> ${to.rota || 'Saida'} · ${edge.totalMin} min`}</title>
              </path>
              {edge.totalMin > 0 && (
                <text
                  x={(from.x + to.x + NODE_W) / 2}
                  y={(from.y + to.y) / 2 + 8}
                  fontSize="10"
                  fill="#64748b"
                  textAnchor="middle"
                >
                  {edge.totalMin} min
                </text>
              )}
            </g>
          );
        })}

        {model.nodes.map((node) => {
          const active = node.id === selectedNodeId || node.id === hoveredNodeId || (!!selectedRoute && node.rota === selectedRoute);
          const bottleneck = node.rota && node.rota === model.metrics.bottleneckRoute;
          const bottleneckStyles = getBottleneckStyles(Boolean(bottleneck));
          const fill = node.kind === 'activity' ? getNodeFill(node.rota, node.execucao, layout) : '#ffffff';
          const stroke = node.kind === 'activity' ? getRotaColor(node.rota, node.execucao, layout) : bottleneckStyles.stroke;
          const dimmed = mode === 'gargalo' && node.kind === 'activity' && !bottleneck;
          const opacity = dimmed ? 0.35 : 1;

          return (
            <g
              key={node.id}
              onMouseEnter={() => onNodeHover(node.id)}
              onMouseLeave={() => onNodeHover(null)}
              onClick={() => onNodeSelect(node.id)}
              style={{ cursor: node.kind === 'merge' ? 'default' : 'pointer' }}
              opacity={opacity}
            >
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={18}
                fill={fill}
                stroke={active ? '#0f172a' : stroke}
                strokeWidth={active ? 2.6 : bottleneck ? 2.1 : 1.4}
                filter="url(#route-tree-shadow)"
              />
              {bottleneck && node.kind === 'activity' && (
                <rect
                  x={node.x - 2}
                  y={node.y - 2}
                  width={NODE_W + 4}
                  height={NODE_H + 4}
                  rx={20}
                  fill="none"
                  stroke={bottleneckStyles.stroke}
                  strokeOpacity="0.65"
                  strokeWidth="1.2"
                />
              )}
              <text x={node.x + 14} y={node.y + 22} fontSize="11" fontWeight="700" fill="#0f172a">
                {node.kind === 'root' ? 'Entrada' : node.kind === 'end' ? 'Saida' : node.kind === 'merge' ? 'Merge' : node.rota || 'Rota'}
              </text>
              <text x={node.x + 14} y={node.y + 38} fontSize="10" fill="#475569">
                {node.kind === 'activity'
                  ? `${node.execucao} · ${node.totalMin} min`
                  : node.kind === 'root'
                    ? model.testName
                    : node.kind === 'end'
                      ? `${model.metrics.totalMin} min`
                      : 'Convergencia'}
              </text>
              {node.kind === 'activity' && (
                <text x={node.x + 14} y={node.y + 52} fontSize="9" fill="#64748b">
                  {node.atividadeLabels.slice(0, 2).join(' / ')}
                </text>
              )}
              <title>
                {node.kind === 'activity'
                  ? `${node.rota} · ${node.totalMin} min · ${node.atividadeLabels.join(' | ')}`
                  : node.kind === 'root'
                    ? model.testName
                    : node.kind === 'end'
                      ? `Saida · ${model.metrics.totalMin} min`
                      : 'Convergencia de fluxos'}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

