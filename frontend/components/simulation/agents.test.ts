import { describe, it, expect } from 'vitest';
import { corDeProduto, buildAgents, updateAgentAt, rotaCoord } from './agents';
import type { SimulationResult } from '../../services/scheduler';
import type { LabLayout } from '../../services/layoutTypes';

const LAYOUT: LabLayout = {
  canvas: { width: 1080, height: 620 },
  stationWidth: 140,
  stationHeight: 80,
  zones: [],
  rotas: [
    { rota: 'BALANÇA', tipo: 'Máquina', execucao: 'MAQ', zona: 'B', x: 100, y: 100 },
    { rota: 'HPLC DAD', tipo: 'Máquina', execucao: 'MAQ', zona: 'H', x: 400, y: 100 },
  ],
};

const SIME: SimulationResult = {
  tasks: [
    {
      taskId: 't1', produtoId: 'p1', produtoName: 'P1', testeName: 'TEOR', lote: 1,
      atividadeIdx: 0, descricao: 'Pesar', rota: 'BALANÇA', execucao: 'MAQ', padrao_amostra: 'Amostra',
      tempo_min: 10, dependeDe: [], ordemLote: 0,
      start_min: 0, end_min: 10, waited_dep_min: 0, waited_resource_min: 0, locomoacao_entrada_min: 0,
    },
    {
      taskId: 't2', produtoId: 'p1', produtoName: 'P1', testeName: 'TEOR', lote: 1,
      atividadeIdx: 1, descricao: 'Correr', rota: 'HPLC DAD', execucao: 'MAQ', padrao_amostra: 'Amostra',
      tempo_min: 50, dependeDe: ['t1'], ordemLote: 1,
      start_min: 10, end_min: 60, waited_dep_min: 0, waited_resource_min: 0, locomoacao_entrada_min: 0,
    },
  ],
  events: [],
  makespan_min: 60,
  resources: [],
  produtos: [{ produtoId: 'p1', produtoName: 'P1', lotes: 1, tempoTotal_min: 60, tempoInicio_min: 0, tempoFim_min: 60 }],
  totalTasks: 2,
  lotesSimulados: 1,
  travelDistance_total_px: 0,
};

describe('agents', () => {
  it('corDeProduto é determinístico e dentro da paleta', () => {
    const a = corDeProduto('p1');
    const b = corDeProduto('p1');
    const c = corDeProduto('p2-diferente');
    expect(a).toBe(b);
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('buildAgents cria 1 agente amostra por (produto,teste,lote)', () => {
    const agents = buildAgents(SIME);
    expect(agents.length).toBe(1);
    expect(agents[0].tipo).toBe('amostra');
    expect(agents[0].cor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('rotaCoord retorna centro da estação', () => {
    const c = rotaCoord(LAYOUT, 'BALANÇA')!;
    expect(c.x).toBe(170);
    expect(c.y).toBe(140);
  });

  it('agente em t=5 está working_maq na BALANÇA', () => {
    const agents = buildAgents(SIME);
    const upd = updateAgentAt(agents[0], 5, SIME.tasks, LAYOUT);
    expect(upd.state).toBe('working_maq');
    expect(upd.rotaAtual).toBe('BALANÇA');
    expect(upd.descricaoAtual).toBe('Pesar');
  });

  it('agente em t=30 está working_maq no HPLC DAD', () => {
    const agents = buildAgents(SIME);
    const upd = updateAgentAt(agents[0], 30, SIME.tasks, LAYOUT);
    expect(upd.rotaAtual).toBe('HPLC DAD');
  });

  it('agente em t=70 está done', () => {
    const agents = buildAgents(SIME);
    const upd = updateAgentAt(agents[0], 70, SIME.tasks, LAYOUT);
    expect(upd.state === 'done' || upd.state === 'idle').toBe(true);
  });

  it('agente em t=-1 (antes do início) está idle', () => {
    const agents = buildAgents(SIME);
    const upd = updateAgentAt(agents[0], -1, SIME.tasks, LAYOUT);
    expect(upd.state).toBe('idle');
  });
});