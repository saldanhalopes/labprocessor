import type { EtapaBasfluxo, AtividadeBasfluxo } from '../types';

export type RouteTreeNodeKind = 'root' | 'activity' | 'merge' | 'end';

export interface RouteTreeNode {
  id: string;
  kind: RouteTreeNodeKind;
  rota: string | null;
  execucao: 'MO' | 'MAQ' | null;
  atividadeLabels: string[];
  totalMin: number;
  depth: number;
  lane: number;
  x: number;
  y: number;
  branchKind?: 'root' | 'seq' | 'parallel' | 'merge';
  stageId?: string;
  stageName?: string;
  stageMode?: 'sequencial' | 'paralelo';
  padraoKinds: Array<'Padrão' | 'Amostra'>;
}

export interface RouteTreeEdge {
  id: string;
  from: string;
  to: string;
  totalMin: number;
  sampleMin: number;
  standardMin: number;
  isCritical?: boolean;
}

export interface RouteTreeStage {
  id: string;
  nome: string;
  modo: 'sequencial' | 'paralelo';
  ordem: number;
  nodeIds: string[];
  totalMin: number;
  effectiveMin: number;
  parallelSavingsMin: number;
}

export interface RouteTreeMetrics {
  totalMin: number;
  moMin: number;
  maqMin: number;
  handoffs: number;
  parallelSavingsMin: number;
  bottleneckRoute: string | null;
  uniqueRoutes: number;
}

export interface RouteTreeModel {
  testName: string;
  nodes: RouteTreeNode[];
  edges: RouteTreeEdge[];
  stages: RouteTreeStage[];
  metrics: RouteTreeMetrics;
  orderedRoutes: string[];
}

const X_PAD = 72;
const Y_PAD = 72;
const DEPTH_GAP = 206;
const LANE_GAP = 112;

interface FrontierNode {
  id: string;
  depth: number;
  lane: number;
}

interface MergedAtividade extends AtividadeBasfluxo {
  atividadeLabels: string[];
  totalMin: number;
  padraoKinds: Array<'Padrão' | 'Amostra'>;
}

function sortEtapas(etapas: EtapaBasfluxo[]): EtapaBasfluxo[] {
  return [...(etapas || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

function normalizeStageActivities(atividades: AtividadeBasfluxo[] = []): MergedAtividade[] {
  const merged: MergedAtividade[] = [];
  for (const atividade of atividades) {
    const prev = merged[merged.length - 1];
    const sameRoute =
      prev &&
      prev.rota === atividade.rota &&
      prev.execucao === atividade.execucao &&
      prev.padrao_amostra === atividade.padrao_amostra;
    if (sameRoute) {
      prev.atividadeLabels.push(atividade.atividade);
      prev.totalMin += atividade.tempo_corrida_minutos || 0;
      prev.padraoKinds.push(atividade.padrao_amostra);
      continue;
    }

    merged.push({
      ...atividade,
      atividadeLabels: [atividade.atividade],
      totalMin: atividade.tempo_corrida_minutos || 0,
      padraoKinds: [atividade.padrao_amostra],
    });
  }
  return merged;
}

function buildMetrics(etapas: EtapaBasfluxo[]): RouteTreeMetrics {
  const sorted = sortEtapas(etapas);
  let totalMin = 0;
  let moMin = 0;
  let maqMin = 0;
  let parallelSavingsMin = 0;
  let handoffs = 0;
  const routeTotals: Record<string, number> = {};
  const uniqueRoutes = new Set<string>();

  let prevRoute: string | null = null;
  for (const etapa of sorted) {
    const stageActivities = normalizeStageActivities(etapa.atividades || []);
    const stageTotal = stageActivities.reduce((sum, item) => sum + (item.totalMin || 0), 0);
    const stageEffective = etapa.modo === 'paralelo'
      ? Math.max(0, ...stageActivities.map((item) => item.totalMin || 0))
      : stageTotal;

    totalMin += stageEffective;
    parallelSavingsMin += Math.max(0, stageTotal - stageEffective);

    for (const item of stageActivities) {
      if (item.execucao === 'MO') moMin += item.totalMin || 0;
      else maqMin += item.totalMin || 0;

      routeTotals[item.rota] = (routeTotals[item.rota] || 0) + (item.totalMin || 0);
      uniqueRoutes.add(item.rota);

      if (prevRoute && prevRoute !== item.rota) handoffs += 1;
      prevRoute = item.rota;
    }
  }

  let bottleneckRoute: string | null = null;
  let maxRouteMin = -1;
  for (const [rota, total] of Object.entries(routeTotals)) {
    if (total > maxRouteMin) {
      maxRouteMin = total;
      bottleneckRoute = rota;
    }
  }

  return {
    totalMin,
    moMin,
    maqMin,
    handoffs,
    parallelSavingsMin,
    bottleneckRoute,
    uniqueRoutes: uniqueRoutes.size,
  };
}

export function buildRouteTree(etapas: EtapaBasfluxo[] = [], testName: string): RouteTreeModel {
  const sortedStages = sortEtapas(etapas);
  const metrics = buildMetrics(sortedStages);
  const nodes: RouteTreeNode[] = [];
  const edges: RouteTreeEdge[] = [];
  const stages: RouteTreeStage[] = [];
  const orderedRoutes: string[] = [];
  const routeSeen = new Set<string>();
  let idCounter = 0;

  const createNode = (partial: Omit<RouteTreeNode, 'id' | 'x' | 'y'>): RouteTreeNode => {
    const node: RouteTreeNode = {
      ...partial,
      id: `node-${idCounter++}`,
      x: 0,
      y: 0,
    };
    nodes.push(node);
    return node;
  };

  const createEdge = (from: string, to: string, totalMin: number, padraoKinds: Array<'Padrão' | 'Amostra'> = []) => {
    const sampleMin = padraoKinds.includes('Amostra') ? totalMin : 0;
    const standardMin = padraoKinds.includes('Padrão') ? totalMin : 0;
    edges.push({
      id: `edge-${edges.length}`,
      from,
      to,
      totalMin,
      sampleMin,
      standardMin,
    });
  };

  const root = createNode({
    kind: 'root',
    rota: null,
    execucao: null,
    atividadeLabels: [testName],
    totalMin: metrics.totalMin,
    depth: 0,
    lane: 0,
    branchKind: 'root',
    padraoKinds: [],
  });

  const frontierMap = new Map<string, FrontierNode>();
  frontierMap.set(root.id, { id: root.id, depth: root.depth, lane: root.lane });
  let frontier: FrontierNode[] = [{ id: root.id, depth: 0, lane: 0 }];

  const mergeFrontier = (): FrontierNode => {
    if (frontier.length === 1) return frontier[0];
    const maxDepth = Math.max(...frontier.map((item) => item.depth));
    const avgLane = frontier.reduce((sum, item) => sum + item.lane, 0) / frontier.length;
    const merge = createNode({
      kind: 'merge',
      rota: null,
      execucao: null,
      atividadeLabels: ['Merge'],
      totalMin: 0,
      depth: maxDepth + 1,
      lane: avgLane,
      branchKind: 'merge',
      padraoKinds: [],
    });
    for (const item of frontier) createEdge(item.id, merge.id, 0, []);
    const next = { id: merge.id, depth: merge.depth, lane: merge.lane };
    frontierMap.set(merge.id, next);
    frontier = [next];
    return next;
  };

  for (const etapa of sortedStages) {
    const normalized = normalizeStageActivities(etapa.atividades || []);
    if (normalized.length === 0) continue;

    const stageId = `stage-${stages.length}`;
    const stageNodeIds: string[] = [];
    const stageTotal = normalized.reduce((sum, item) => sum + (item.totalMin || 0), 0);
    const stageEffective = etapa.modo === 'paralelo'
      ? Math.max(0, ...normalized.map((item) => item.totalMin || 0))
      : stageTotal;

    const anchor = mergeFrontier();

    if (etapa.modo === 'paralelo') {
      const startLane = anchor.lane - (normalized.length - 1) / 2;
      const nextFrontier: FrontierNode[] = [];
      normalized.forEach((item, index) => {
        const node = createNode({
          kind: 'activity',
          rota: item.rota,
          execucao: item.execucao,
          atividadeLabels: item.atividadeLabels,
          totalMin: item.totalMin,
          depth: anchor.depth + 1,
          lane: startLane + index,
          branchKind: 'parallel',
          stageId,
          stageName: etapa.nome,
          stageMode: etapa.modo,
          padraoKinds: item.padraoKinds,
        });
        createEdge(anchor.id, node.id, item.totalMin, item.padraoKinds);
        stageNodeIds.push(node.id);
        nextFrontier.push({ id: node.id, depth: node.depth, lane: node.lane });
        frontierMap.set(node.id, nextFrontier[nextFrontier.length - 1]);
        if (!routeSeen.has(item.rota)) {
          routeSeen.add(item.rota);
          orderedRoutes.push(item.rota);
        }
      });
      frontier = nextFrontier;
    } else {
      let current = anchor;
      normalized.forEach((item) => {
        const node = createNode({
          kind: 'activity',
          rota: item.rota,
          execucao: item.execucao,
          atividadeLabels: item.atividadeLabels,
          totalMin: item.totalMin,
          depth: current.depth + 1,
          lane: current.lane,
          branchKind: 'seq',
          stageId,
          stageName: etapa.nome,
          stageMode: etapa.modo,
          padraoKinds: item.padraoKinds,
        });
        createEdge(current.id, node.id, item.totalMin, item.padraoKinds);
        current = { id: node.id, depth: node.depth, lane: node.lane };
        frontierMap.set(node.id, current);
        stageNodeIds.push(node.id);
        if (!routeSeen.has(item.rota)) {
          routeSeen.add(item.rota);
          orderedRoutes.push(item.rota);
        }
      });
      frontier = [current];
    }

    stages.push({
      id: stageId,
      nome: etapa.nome,
      modo: etapa.modo,
      ordem: etapa.ordem,
      nodeIds: stageNodeIds,
      totalMin: stageTotal,
      effectiveMin: stageEffective,
      parallelSavingsMin: Math.max(0, stageTotal - stageEffective),
    });
  }

  const endAnchor = mergeFrontier();
  const end = createNode({
    kind: 'end',
    rota: null,
    execucao: null,
    atividadeLabels: ['Saida'],
    totalMin: metrics.totalMin,
    depth: endAnchor.depth + 1,
    lane: endAnchor.lane,
    branchKind: 'seq',
    padraoKinds: [],
  });
  createEdge(endAnchor.id, end.id, 0, []);

  const minLane = Math.min(...nodes.map((node) => node.lane));
  for (const node of nodes) {
    node.x = X_PAD + node.depth * DEPTH_GAP;
    node.y = Y_PAD + (node.lane - minLane) * LANE_GAP;
  }

  const routeTotals: Record<string, number> = {};
  for (const node of nodes) {
    if (!node.rota) continue;
    routeTotals[node.rota] = (routeTotals[node.rota] || 0) + node.totalMin;
  }
  for (const edge of edges) {
    const toNode = nodes.find((node) => node.id === edge.to);
    if (toNode?.rota && metrics.bottleneckRoute === toNode.rota) edge.isCritical = true;
  }

  return {
    testName,
    nodes,
    edges,
    stages,
    metrics,
    orderedRoutes,
  };
}

