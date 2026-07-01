import React, { useMemo } from 'react';
import { GitBranch } from 'lucide-react';

interface Atividade {
  atividade: string;
  rota: string;
  execucao: string;
  padrao_amostra: string;
  tempo_corrida_minutos: number;
}

interface Etapa {
  nome: string;
  modo: 'sequencial' | 'paralelo';
  ordem: number;
  atividades: Atividade[];
}

interface FlowRouteDiagramProps {
  etapas: Etapa[];
  testName: string;
}

const NODE_W = 160;
const NODE_H = 38;
const NODE_GAP_X = 20;
const NODE_GAP_Y = 12;
const STAGE_PAD = 20;
const STAGE_GAP = 28;
const LABEL_H = 28;

const ROUTE_COLORS: Record<string, string> = {
  'HPLC DAD': '#3b82f6',
  'HPLC UV': '#3b82f6',
  'ANALISTA EQUIP - HPLC': '#f59e0b',
  'BOMBA DE LAVAGEM': '#8b5cf6',
};

function getRouteColor(rota: string, execucao: string): string {
  if (ROUTE_COLORS[rota]) return ROUTE_COLORS[rota];
  return execucao === 'MO' ? '#f59e0b' : '#3b82f6';
}

export const FlowRouteDiagram: React.FC<FlowRouteDiagramProps> = ({ etapas, testName }) => {
  const { svgWidth, svgHeight, nodes } = useMemo(() => {
    if (etapas.length === 0) return { svgWidth: 400, svgHeight: 120, nodes: [] };

    let currentY = 20;
    const allNodes: any[] = [];

    for (const etapa of etapas) {
      const atvs = etapa.atividades || [];
      const stageTop = currentY;
      const numRows = 1;
      const rowWidth = atvs.length * (NODE_W + NODE_GAP_X) - NODE_GAP_X;
      const stageWidth = Math.max(200, rowWidth + STAGE_PAD * 2);
      const contentH = NODE_H + NODE_GAP_Y;

      const stageNodes = atvs.map((a, i) => ({
        x: STAGE_PAD + i * (NODE_W + NODE_GAP_X),
        y: LABEL_H + STAGE_PAD,
        atividade: a.atividade,
        rota: a.rota || '?',
        execucao: a.execucao,
        padrao_amostra: a.padrao_amostra,
        tempo: a.tempo_corrida_minutos || 0,
        color: getRouteColor(a.rota, a.execucao),
        etapaIdx: etapas.indexOf(etapa),
        atvIdx: i,
      }));

      const stageHeight = LABEL_H + contentH + STAGE_PAD;
      allNodes.push({
        etapa,
        stageTop,
        stageWidth,
        stageHeight,
        nodes: stageNodes,
      });

      currentY += stageHeight + STAGE_GAP;
    }

    const maxW = Math.max(400, ...allNodes.map(s => s.stageWidth + STAGE_PAD));
    const totalH = currentY + 60;

    return { svgWidth: maxW, svgHeight: totalH, nodes: allNodes };
  }, [etapas]);

  if (etapas.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        Nenhuma etapa com atividades para visualizar.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-teal-600" />
        <span className="text-xs font-bold text-slate-700">Fluxo de Rotas: {testName}</span>
      </div>

      <div className="overflow-auto no-scrollbar" style={{ maxHeight: '600px' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{ minWidth: '100%' }}
        >
          <defs>
            <marker id="arrowHead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#94a3b8" />
            </marker>
            <marker id="arrowHeadSeq" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#0d9488" />
            </marker>
            <filter id="shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Legend */}
          <g transform="translate(10, 5)">
            <rect x="0" y="0" width="320" height="16" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
            <text x="8" y="11" fontSize="9" fill="#64748b" fontWeight="500">Legenda:</text>
            <rect x="72" y="3" width="10" height="10" rx="2" fill="#f59e0b" opacity="0.8" />
            <text x="85" y="11" fontSize="8" fill="#64748b">MO</text>
            <rect x="110" y="3" width="10" height="10" rx="2" fill="#3b82f6" opacity="0.8" />
            <text x="123" y="11" fontSize="8" fill="#64748b">MAQ</text>
            <rect x="156" y="3" width="10" height="10" rx="2" fill="white" stroke="#64748b" strokeWidth="1" />
            <text x="169" y="11" fontSize="8" fill="#64748b">Padrão</text>
            <rect x="212" y="3" width="10" height="10" rx="2" fill="#f1f5f9" stroke="#64748b" strokeWidth="1" strokeDasharray="2 1" />
            <text x="225" y="11" fontSize="8" fill="#64748b">Amostra</text>
          </g>

          {nodes.map((stageData) => {
            const { etapa, stageTop, stageWidth, stageHeight, nodes: stageNodes } = stageData;

            return (
              <g key={`${etapa.nome}-${etapa.ordem}`}>
                {/* Stage bounding box */}
                <rect
                  x={10}
                  y={stageTop}
                  width={stageWidth}
                  height={stageHeight}
                  rx={8}
                  fill="none"
                  stroke={etapa.modo === 'paralelo' ? '#f59e0b' : '#0d9488'}
                  strokeWidth={1.5}
                  strokeDasharray={etapa.modo === 'paralelo' ? '6 3' : undefined}
                  opacity={0.6}
                />

                {/* Stage label */}
                <rect
                  x={14}
                  y={stageTop + 4}
                  width={stageWidth - 8}
                  height={LABEL_H}
                  rx={4}
                  fill={etapa.modo === 'paralelo' ? '#fef3c7' : '#ccfbf1'}
                  opacity={0.9}
                />
                <text
                  x={24}
                  y={stageTop + LABEL_H / 2 + 4}
                  fontSize={11}
                  fontWeight={700}
                  fill="#1e293b"
                >
                  {etapa.nome}
                  <tspan fill="#64748b" fontWeight={500}> — {etapa.modo === 'paralelo' ? 'Paralelo' : 'Sequencial'}</tspan>
                </text>

                {/* Arrows between activities within stage */}
                {etapa.modo === 'sequencial' && stageNodes.map((node: any, i: number) => {
                  if (i === stageNodes.length - 1) return null;
                  const x1 = node.x + NODE_W;
                  const y1 = node.y + NODE_H / 2;
                  const x2 = stageNodes[i + 1].x;
                  const y2 = y1;
                  return (
                    <g key={`arrow-${etapa.ordem}-${i}`}>
                      <line x1={x1 + 2} y1={y1} x2={x2 - 6} y2={y2} stroke="#0d9488" strokeWidth={1.5} markerEnd="url(#arrowHeadSeq)" />
                    </g>
                  );
                })}
                {etapa.modo === 'paralelo' && stageNodes.length > 1 && (
                  <g>
                    <text
                      x={stageNodes[0].x + NODE_W + 20}
                      y={stageNodes[0].y - 6}
                      fontSize={9}
                      fill="#f59e0b"
                      fontWeight={600}
                      textAnchor="middle"
                    >
                      ⇉ paralelo
                    </text>
                  </g>
                )}

                {/* Activity nodes */}
                {stageNodes.map((node: any) => {
                  const isAmostra = node.padrao_amostra === 'Amostra';
                  return (
                    <g key={`${node.etapaIdx}-${node.atvIdx}`}>
                      <rect
                        x={node.x}
                        y={node.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={6}
                        fill={isAmostra ? '#f8fafc' : 'white'}
                        stroke={node.color}
                        strokeWidth={1.5}
                        strokeDasharray={isAmostra ? '4 2' : undefined}
                        filter="url(#shadow)"
                      />
                      <rect
                        x={node.x}
                        y={node.y}
                        width={4}
                        height={NODE_H}
                        rx={2}
                        fill={node.color}
                      />
                      <text
                        x={node.x + 12}
                        y={node.y + 13}
                        fontSize={10}
                        fontWeight={600}
                        fill="#1e293b"
                      >
                        {node.rota}
                      </text>
                      <text
                        x={node.x + 12}
                        y={node.y + 27}
                        fontSize={8}
                        fill="#94a3b8"
                      >
                        {node.execucao} · {node.padrao_amostra === 'Padrão' ? 'P' : 'A'} · {node.tempo}min
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Flow summary at bottom */}
          <g transform={`translate(10, ${svgHeight - 50})`}>
            <rect x="0" y="0" width={svgWidth - 20} height="40" rx="6" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1" />
            <text x="16" y="16" fontSize="10" fontWeight={600} fill="#166534">
              {etapas.length} etapa(s) · {etapas.reduce((s, e) => s + e.atividades.length, 0)} atividade(s)
            </text>
            <text x="16" y="30" fontSize="9" fill="#64748b">
              Sequencial: soma dos tempos · Paralelo: maior tempo entre atividades da etapa
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};
