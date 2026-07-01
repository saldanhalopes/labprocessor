import type { AnalysisResult, GlobalSettings, AtividadeBasfluxo, EtapaBasfluxo, TesteBasfluxo } from '../types';
import type { LabLayout, LabRota } from './layoutTypes';

export interface SimTask {
  taskId: string;
  produtoId: string;
  produtoName: string;
  testeName: string;
  lote: number;
  atividadeIdx: number;
  descricao: string;
  rota: string;
  execucao: 'MAQ' | 'MO';
  padrao_amostra: string;
  tempo_min: number;
  dependeDe: string[];
  ordemLote: number;
  locomoacao_entrada_min: number;
}

export interface ScheduledTask extends SimTask {
  start_min: number;
  end_min: number;
  waited_dep_min: number;
  waited_resource_min: number;
  locomoacao_entrada_min: number;
}

export interface SimEvent {
  type: 'start' | 'end' | 'travel';
  time_min: number;
  taskId: string;
  produtoName: string;
  testeName: string;
  lote: number;
  rota?: string;
  detalhe?: string;
}

export interface ResourceUtil {
  rota: string;
  tipo: string;
  totalBusy_min: number;
  totalIdle_min: number;
  utilization_pct: number;
  numAtendimentos: number;
}

export interface ProductStat {
  produtoId: string;
  produtoName: string;
  lotes: number;
  tempoTotal_min: number;
  tempoInicio_min: number;
  tempoFim_min: number;
}

export interface SimulationResult {
  tasks: ScheduledTask[];
  events: SimEvent[];
  makespan_min: number;
  resources: ResourceUtil[];
  produtos: ProductStat[];
  totalTasks: number;
  lotesSimulados: number;
  travelDistance_total_px: number;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  area: 1160,
  velocity: 60,
  alpha: 4,
  setupFactor: 5,
  registerFactor: 0.5,
  labEfficiency: 0.75,
  factorRun: 0.10,
  factorIncubation: 0.02,
  dailyAvailableMinutes: 528,
};

interface RotaCoord {
  nome: string;
  x: number;
  y: number;
}

function coordOf(layout: LabLayout, rotaNome: string): RotaCoord | null {
  const r = layout.rotas.find((x: LabRota) => x.rota === rotaNome);
  if (!r) return null;
  return { nome: r.rota, x: r.x, y: r.y };
}

function distancia(a: RotaCoord | null, b: RotaCoord | null): number {
  if (!a || !b) return 0;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function tempoLocomocao(distPx: number, settings: GlobalSettings): number {
  if (distPx === 0) return 0;
  const distM = distPx / 100;
  return (distM / settings.velocity) * settings.alpha;
}

interface ExpandedAtividade {
  descricao: string;
  rota: string;
  execucao: string;
  padrao_amostra: string;
  tempo_min: number;
}

function expandAtividades(teste: TesteBasfluxo | undefined, fallback?: ExpandedAtividade[]): ExpandedAtividade[] {
  if (teste?.etapas && teste.etapas.length > 0) {
    let acc: ExpandedAtividade[] = [];
    teste.etapas.forEach((etapa: EtapaBasfluxo) => {
      const atvs: ExpandedAtividade[] = (etapa.atividades || []).map((a: AtividadeBasfluxo) => ({
        descricao: a.atividade,
        rota: a.rota,
        execucao: a.execucao,
        padrao_amostra: a.padrao_amostra,
        tempo_min: a.tempo_corrida_minutos,
      }));
      acc = acc.concat(atvs);
    });
    return acc;
  }
  return fallback || [];
}

function basfluxoAtividades(p: AnalysisResult): ExpandedAtividade[] {
  const testes = p.basfluxo?.testes || [];
  const acc: ExpandedAtividade[] = [];
  testes.forEach((t: any) => {
    const acts: ExpandedAtividade[] = (t.atividades || []).map((a: any) => ({
      descricao: a.descricao,
      rota: a.rota,
      execucao: a.execucao,
      padrao_amostra: a.padrao_amostra,
      tempo_min: a.tempo_min,
    }));
    acc.push(...acts);
  });
  return acc;
}

export interface SchedulerInput {
  products: AnalysisResult[];
  lotesPorProduto: Record<string, number>;
  settings?: Partial<GlobalSettings>;
  layout: LabLayout;
  ignoraAtividadeCurta?: number;
}

function isValid(a: ExpandedAtividade, ignora: number): boolean {
  if (!a.rota || !a.descricao) return false;
  if (a.tempo_min < ignora) return false;
  return true;
}

function filaChave(p: SimTask): string {
  return `${p.produtoId}|${p.testeName}|${p.lote}|${p.atividadeIdx}`;
}

export function simulateFIFO(input: SchedulerInput): SimulationResult {
  const emptyResult = (): SimulationResult => ({
    tasks: [], events: [], makespan_min: 0,
    resources: input.layout.rotas.map((lr: LabRota) => ({
      rota: lr.rota, tipo: lr.tipo || 'Máquina', totalBusy_min: 0,
      totalIdle_min: 0, utilization_pct: 0, numAtendimentos: 0,
    })),
    produtos: [], totalTasks: 0, lotesSimulados: 0, travelDistance_total_px: 0,
  });

  if (!input.products || input.products.length === 0) return emptyResult();
  const settings: GlobalSettings = { ...DEFAULT_SETTINGS, ...(input.settings || {}) } as GlobalSettings;
  const ignora = input.ignoraAtividadeCurta ?? -1;

  let globalIdx = 0;
  const genId = (): string => `t${++globalIdx}`;

  const tasks: SimTask[] = [];
  for (const p of input.products) {
    const L = Math.max(1, input.lotesPorProduto[p.fileId] || input.lotesPorProduto[p.product.productName] || 1);
    const testes = p.basfluxo?.testes || [];
    for (const teste of testes) {
      const nomeTeste = teste.teste || String(teste.rota || '');
      let atividades: ExpandedAtividade[] = (teste.atividades || []).map((a: any) => ({
        descricao: a.descricao,
        rota: a.rota,
        execucao: a.execucao,
        padrao_amostra: a.padrao_amostra,
        tempo_min: a.tempo_min,
      })) as ExpandedAtividade[];

      if (atividades.length === 0) {
        const fallback: ExpandedAtividade[] = basfluxoAtividades(p).filter((x) => x.descricao && x.rota);
        if (fallback.length > 0 && fallback[0]?.descricao) {
          atividades = fallback;
        }
      }
      if (atividades.length === 0) continue;

      for (let lote = 1; lote <= L; lote++) {
        let prevId: string | null = null;
        let prevRotaNome: string | null = null;
        let atvIdx = 0;
        for (const a of atividades) {
          if (!isValid(a, ignora)) {
            atvIdx++;
            continue;
          }
          const id = genId();
          const prevCoord = prevRotaNome ? coordOf(input.layout, prevRotaNome) : null;
          const curCoord = coordOf(input.layout, a.rota);
          const distPx = distancia(prevCoord, curCoord);
          const locMin = tempoLocomocao(distPx, settings);
          tasks.push({
            taskId: id,
            produtoId: p.fileId,
            produtoName: p.product.productName,
            testeName: nomeTeste,
            lote,
            atividadeIdx: atvIdx,
            descricao: a.descricao,
            rota: a.rota,
            execucao: (a.execucao === 'MO' ? 'MO' : 'MAQ') as 'MAQ' | 'MO',
            padrao_amostra: a.padrao_amostra,
            tempo_min: a.tempo_min,
            dependeDe: prevId ? [prevId] : [],
            ordemLote: atvIdx,
            locomoacao_entrada_min: locMin,
          });
          prevId = id;
          prevRotaNome = a.rota;
          atvIdx++;
        }
      }
    }
  }

  const recursoBusy_until: Record<string, number> = {};
  const recursoCount: Record<string, number> = {};
  for (const t of tasks) {
    recursoBusy_until[t.rota] = 0;
    recursoCount[t.rota] = 0;
  }

  const scheduledMap: Record<string, ScheduledTask> = {};
  const remaining: SimTask[] = [...tasks];

  let iter = 0;
  const maxIter = tasks.length * 4 + 100;
  while (remaining.length > 0) {
    iter++;
    if (iter > maxIter) {
      throw new Error(`scheduler deadlock — ${remaining.length} tasks unresolvable after ${maxIter} iterations`);
    }
    let progress = false;
    for (let i = 0; i < remaining.length; i++) {
      const t = remaining[i];
      const deps = t.dependeDe || [];
      const allDepsDone = deps.every((d: string) => scheduledMap[d]);
      if (!allDepsDone) continue;

      const depEnds = deps.map((d: string) => scheduledMap[d].end_min);
      const depEnd = depEnds.length ? Math.max(...depEnds) : 0;
      const earliestResource = recursoBusy_until[t.rota];
      const start = Math.max(depEnd + t.locomoacao_entrada_min, earliestResource);
      const end = start + t.tempo_min;

scheduledMap[t.taskId] = {
        ...t,
        start_min: start,
        end_min: end,
        waited_dep_min: deps.length && depEnd > earliestResource ? 0 : earliestResource > depEnd ? earliestResource - depEnd - t.locomoacao_entrada_min : 0,
        waited_resource_min: Math.max(0, earliestResource - (depEnd + t.locomoacao_entrada_min)),
      };
      recursoBusy_until[t.rota] = end;
      recursoCount[t.rota]++;
      remaining.splice(i, 1);
      progress = true;
      break;
    }
    if (!progress) {
      throw new Error(`scheduler stuck: cannot schedule any of ${remaining.length} remaining tasks (circular deps?)`);
    }
  }

  const scheduled = Object.values(scheduledMap);
  const makespan = scheduled.reduce((m, t) => Math.max(m, t.end_min), 0);

  const resources: ResourceUtil[] = input.layout.rotas.map((lr: LabRota) => {
    const rota = lr.rota;
    const busy = scheduled.filter((t) => t.rota === rota).reduce((s, t) => s + t.tempo_min, 0);
    const idle = Math.max(0, makespan - busy);
    return {
      rota,
      tipo: lr.tipo || 'Máquina',
      totalBusy_min: busy,
      totalIdle_min: idle,
      utilization_pct: makespan > 0 ? (busy / makespan) * 100 : 0,
      numAtendimentos: recursoCount[rota] || 0,
    };
  });

  const produtosMap: Record<string, ProductStat> = {};
  for (const t of scheduled) {
    const key = t.produtoId;
    if (!produtosMap[key]) {
      produtosMap[key] = { produtoId: t.produtoId, produtoName: t.produtoName, lotes: 0, tempoTotal_min: 0, tempoInicio_min: Infinity, tempoFim_min: 0 };
    }
    const ps = produtosMap[key];
    ps.tempoInicio_min = Math.min(ps.tempoInicio_min, t.start_min);
    ps.tempoFim_min = Math.max(ps.tempoFim_min, t.end_min);
    ps.tempoTotal_min = ps.tempoFim_min - ps.tempoInicio_min;
  }
  for (const p of input.products) {
    if (produtosMap[p.fileId]) produtosMap[p.fileId].lotes = input.lotesPorProduto[p.fileId] || 1;
  }

  const events: SimEvent[] = [];
  for (const t of scheduled) {
    events.push({ type: 'start', time_min: t.start_min, taskId: t.taskId, produtoName: t.produtoName, testeName: t.testeName, lote: t.lote, rota: t.rota });
    events.push({ type: 'end', time_min: t.end_min, taskId: t.taskId, produtoName: t.produtoName, testeName: t.testeName, lote: t.lote, rota: t.rota });
  }
  events.sort((a, b) => a.time_min - b.time_min);

  const travelDistance_total_px = 0;

  return {
    tasks: scheduled,
    events,
    makespan_min: makespan,
    resources,
    produtos: Object.values(produtosMap),
    totalTasks: scheduled.length,
    lotesSimulados: Object.values(produtosMap).reduce((s, p) => s + p.lotes, 0),
    travelDistance_total_px,
  };
}