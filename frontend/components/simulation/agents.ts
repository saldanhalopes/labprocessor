import type { SimulationResult, ScheduledTask } from '../../services/scheduler';
import type { LabLayout, LabRota, LabZone } from '../../services/layoutTypes';

export interface AgentState {
  id: string;
  tipo: 'analista' | 'amostra';
  produtoId: string;
  produtoName: string;
  testeName: string;
  lote: number;
  cor: string;
  currentTaskId: string | null;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: 'idle' | 'traveling' | 'working_maq' | 'working_mo' | 'done';
  busyUntil: number;
  taskStart: number;
  taskEnd: number;
  rotaAtual: string | null;
  descricaoAtual: string | null;
  execucaoAtual: 'MAQ' | 'MO' | null;
}

export const PRODUTO_CORES = [
  '#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d',
  '#0d9488', '#9f1239', '#1e40af', '#15803d', '#b45309',
];

export function corDeProduto(produtoId: string): string {
  let h = 0;
  for (let i = 0; i < produtoId.length; i++) h = (h * 31 + produtoId.charCodeAt(i)) >>> 0;
  return PRODUTO_CORES[h % PRODUTO_CORES.length];
}

export interface AnimationState {
  agents: AgentState[];
  tiempoVisualizado_min: number;
  tarefasConcluidas: number;
  tarefasTotais: number;
}

export function buildAgents(sim: SimulationResult): AgentState[] {
  const porTeste = new Map<string, ScheduledTask[]>();
  for (const t of sim.tasks) {
    const k = `${t.produtoId}|${t.testeName}|${t.lote}`;
    const arr = porTeste.get(k) || [];
    arr.push(t);
    porTeste.set(k, arr);
  }

  const agents: AgentState[] = [];
  let agentIdx = 0;
  porTeste.forEach((tasks, k) => {
    const [produtoId, , lote] = k.split('|');
    const first = tasks[0];
    if (!first) return;
    tasks.sort((a, b) => a.start_min - b.start_min);
    agents.push({
      id: `amostra-${agentIdx++}`,
      tipo: 'amostra',
      produtoId,
      produtoName: first.produtoName,
      testeName: first.testeName,
      lote: Number(lote),
      cor: corDeProduto(produtoId),
      currentTaskId: null,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      state: 'idle',
      busyUntil: 0,
      taskStart: 0,
      taskEnd: 0,
      rotaAtual: null,
      descricaoAtual: null,
      execucaoAtual: null,
    });
  });

  return agents;
}

export function rotaCoord(layout: LabLayout, rotaNome: string): { x: number; y: number } | null {
  const r = layout.rotas.find((x: LabRota) => x.rota === rotaNome);
  if (!r) return null;
  return { x: r.x + layout.stationWidth / 2, y: r.y + layout.stationHeight / 2 };
}

export function updateAgentAt(
  agent: AgentState,
  tiempo_min: number,
  tasks: ScheduledTask[],
  layout: LabLayout
): AgentState {
  const future = tasks.filter((t) => t.start_min <= tiempo_min);
  const current = future.length > 0 ? future[future.length - 1] : null;
  const next =
    current && current.end_min <= tiempo_min
      ? tasks.find((t) => t.start_min >= tiempo_min && t.produtoId === agent.produtoId && t.testeName === agent.testeName && t.lote === agent.lote)
      : null;

  if (!current) {
    return { ...agent, state: 'idle', x: 20, y: layout.canvas.height - 30, targetX: 20, targetY: layout.canvas.height - 30, currentTaskId: null, rotaAtual: null, descricaoAtual: null, execucaoAtual: null };
  }

  const coord = rotaCoord(layout, current.rota) || { x: 20, y: 20 };
  if (tiempo_min < current.end_min) {
    return {
      ...agent,
      currentTaskId: current.taskId,
      state: current.execucao === 'MAQ' ? 'working_maq' : 'working_mo',
      x: coord.x,
      y: coord.y,
      targetX: coord.x,
      targetY: coord.y,
      taskStart: current.start_min,
      taskEnd: current.end_min,
      rotaAtual: current.rota,
      descricaoAtual: current.descricao,
      execucaoAtual: current.execucao,
    };
  }
  const nextCoord = next ? rotaCoord(layout, next.rota) : null;
  return {
    ...agent,
    currentTaskId: next ? next.taskId : null,
    state: next ? 'traveling' : 'done',
    x: coord.x,
    y: coord.y,
    targetX: nextCoord ? nextCoord.x : coord.x,
    targetY: nextCoord ? nextCoord.y : coord.y,
    taskStart: next ? next.start_min : current.end_min,
    taskEnd: next ? next.end_min : current.end_min,
    rotaAtual: next ? next.rota : null,
    descricaoAtual: next ? next.descricao : null,
    execucaoAtual: next ? next.execucao : null,
  };
}