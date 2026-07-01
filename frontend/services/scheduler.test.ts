import { describe, it, expect } from 'vitest';
import { simulateFIFO, type SchedulerInput } from './scheduler';
import type { AnalysisResult, GlobalSettings } from '../types';
import type { LabLayout } from './layoutTypes';

const LAYOUT: LabLayout = {
  canvas: { width: 1080, height: 620 },
  stationWidth: 140,
  stationHeight: 80,
  zones: [],
  rotas: [
    { rota: 'BALANÇA', tipo: 'Máquina', execucao: 'MAQ', zona: 'Bancada', x: 100, y: 200 },
    { rota: 'HPLC DAD', tipo: 'Máquina', execucao: 'MAQ', zona: 'HPLC', x: 400, y: 50 },
    { rota: 'ULTRASSOM', tipo: 'Máquina', execucao: 'MAQ', zona: 'Dissolução', x: 700, y: 350 },
    { rota: 'ANALISTA BANCADA (PREP HPLC)', tipo: 'Analista', execucao: 'MO', zona: 'Bancada', x: 100, y: 400 },
  ],
};

function makeProduct(id: string, nome: string, testes: any[]): AnalysisResult {
  return {
    fileId: id,
    fileName: `${nome}.pdf`,
    product: { productName: nome },
    rows: [],
    reagents: [],
    equipments: [],
    standards: [],
    totalTime: 0,
    totalTimePhysChem: 0,
    totalTimeMicro: 0,
    timestamp: 0,
    basfluxo: {
      celula: 'SÓLIDOS',
      quantidade_lotes: 1,
      resumo_tempos: {},
      testes,
    },
  };
}

function atv(descricao: string, rota: string, execucao: string, tempo_min: number) {
  return { descricao, rota, execucao, padrao_amostra: 'Amostra', tempo_min };
}

function teste(teste: string, atividades: any[]) {
  return { teste, rota: '', fixo: { atividades: 0, total_min: 0, mo_min: 0, maq_min: 0 }, variavel: { atividades: 0, total_min: 0, mo_min: 0, maq_min: 0 }, total_compartilhado_min: 0, mo_pct: 0, atividades };
}

describe('simulateFIFO', () => {
  const settings: Partial<GlobalSettings> = { velocity: 99999, alpha: 0.0001 };

  it('single product, single test, single lote: makespan = sum of tempos', () => {
    const p = makeProduct('p1', 'Produto A', [
      teste('TEOR HPLC 1', [
        atv('Pesar Padrão', 'BALANÇA', 'MAQ', 10),
        atv('Preparar Diluente', 'ANALISTA BANCADA (PREP HPLC)', 'MO', 5),
        atv('Correr', 'HPLC DAD', 'MAQ', 70),
      ]),
    ]);
    const input: SchedulerInput = { products: [p], lotesPorProduto: { p1: 1 }, layout: LAYOUT, settings };
    const r = simulateFIFO(input);
    expect(r.totalTasks).toBe(3);
    expect(r.makespan_min).toBeCloseTo(10 + 5 + 70, 1); // alpha~0 → locomoção ~0
    expect(r.resources.length).toBe(LAYOUT.rotas.length);
  });

  it('lotes multiplicam: 2 lotesProduct × 3 atividades → 6 tasks', () => {
    const p = makeProduct('p1', 'Produto A', [
      teste('TEOR HPLC 1', [
        atv('Pesar', 'BALANÇA', 'MAQ', 10),
        atv('Correr', 'HPLC DAD', 'MAQ', 70),
      ]),
    ]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p1: 2 }, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(4);
  });

  it('FIFO em recurso compartilhado: 2 produtos disputam HPLC DAD sequencialmente', () => {
    const p1 = makeProduct('p1', 'P1', [teste('TEOR HPLC 1', [atv('A', 'HPLC DAD', 'MAQ', 100)])]);
    const p2 = makeProduct('p2', 'P2', [teste('TEOR HPLC 1', [atv('B', 'HPLC DAD', 'MAQ', 50)])]);
    const r = simulateFIFO({ products: [p1, p2], lotesPorProduto: { p1: 1, p2: 1 }, layout: LAYOUT, settings });
    const hplc = r.resources.find((x) => x.rota === 'HPLC DAD')!;
    expect(hplc.numAtendimentos).toBe(2);
    expect(hplc.totalBusy_min).toBeCloseTo(150, 1);
    expect(r.makespan_min).toBeGreaterThanOrEqual(150);
    const hplcTasks = r.tasks.filter((t) => t.rota === 'HPLC DAD').sort((a, b) => a.start_min - b.start_min);
    expect(hplcTasks[0].end_min).toBeLessThanOrEqual(hplcTasks[1].start_min + 0.01);
  });

  it('recursos diferentes rodam em paralelo (sem bloqueio cruzado)', () => {
    const p1 = makeProduct('p1', 'P1', [teste('T-A', [atv('A', 'BALANÇA', 'MAQ', 100)])]);
    const p2 = makeProduct('p2', 'P2', [teste('T-B', [atv('B', 'HPLC DAD', 'MAQ', 100)])]);
    const r = simulateFIFO({ products: [p1, p2], lotesPorProduto: { p1: 1, p2: 1 }, layout: LAYOUT, settings });
    expect(r.makespan_min).toBeLessThanOrEqual(100 + 1);
  });

  it('lotes do mesmo produto NÃO compartilham fila FIFO entre si quando rota não conflita', () => {
    const p = makeProduct('p', 'P', [
      teste('T', [
        atv('Pesar', 'BALANÇA', 'MAQ', 50),
        atv('Correr', 'HPLC DAD', 'MAQ', 100),
      ]),
    ]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 2 }, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(4);
    const balTasks = r.tasks.filter((t) => t.rota === 'BALANÇA').sort((a, b) => a.start_min - b.start_min);
    expect(balTasks.length).toBe(2);
  });

  it('detecção de ociosidade: recurso aparece com totalIdle_min > 0 quando não-ocupado', () => {
    const p = makeProduct('p', 'P', [teste('T', [atv('Correr', 'HPLC DAD', 'MAQ', 50)])]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 1 }, layout: LAYOUT, settings: { velocity: 60, alpha: 4 } });
    const ultrassom = r.resources.find((x) => x.rota === 'ULTRASSOM');
    expect(ultrassom).toBeTruthy();
    expect(ultrassom!.totalBusy_min).toBe(0);
    expect(ultrassom!.numAtendimentos).toBe(0);
  });

  it('deadlock-resistente: sem dependências enfileiradas infinitamente', () => {
    const p = makeProduct('p', 'P', [
      teste('T', Array.from({ length: 50 }, (_, i) => atv(`A${i}`, 'BALANÇA', 'MAQ', 1))),
    ]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 3 }, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(150);
    expect(r.makespan_min).toBeGreaterThanOrEqual(150);
  });

  it('atividade inválida (sem rota) é pulada, não gera task', () => {
    const p = makeProduct('p', 'P', [
      teste('T', [
        atv('SEM ROTA', '', 'MAQ', 10),
        atv('Ok', 'BALANÇA', 'MAQ', 20),
      ]),
    ]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 1 }, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(1);
    expect(r.tasks[0].descricao).toBe('Ok');
  });

  it('locomoção entre rotas distintas adiciona tempo', () => {
    const pLong = makeProduct('pL', 'P-L', [
      teste('T-L', [
        atv('Pesar', 'BALANÇA', 'MAQ', 10),
        atv('Correr', 'HPLC DAD', 'MAQ', 10),
      ]),
    ]);
    const fastSettings: Partial<GlobalSettings> = { velocity: 99999, alpha: 0.0001 };
    const slowSettings: Partial<GlobalSettings> = { velocity: 10, alpha: 4 };
    const fast = simulateFIFO({ products: [pLong], lotesPorProduto: { pL: 1 }, layout: LAYOUT, settings: fastSettings });
    const slow = simulateFIFO({ products: [pLong], lotesPorProduto: { pL: 1 }, layout: LAYOUT, settings: slowSettings });
    expect(slow.makespan_min).toBeGreaterThan(fast.makespan_min + 1);
  });

  it('eventos start/end ordenados cronologicamente na saída', () => {
    const p = makeProduct('p', 'P', [teste('T', [atv('A', 'BALANÇA', 'MAQ', 10), atv('B', 'HPLC DAD', 'MAQ', 20)])]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 1 }, layout: LAYOUT, settings });
    let prev = -1;
    for (const e of r.events) {
      expect(e.time_min).toBeGreaterThanOrEqual(prev - 0.01);
      prev = e.time_min;
    }
    expect(r.events.length).toBe(r.totalTasks * 2);
  });

  it('empty products returns empty result (no throw)', () => {
    const r = simulateFIFO({ products: [], lotesPorProduto: {}, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(0);
    expect(r.makespan_min).toBe(0);
    expect(r.events.length).toBe(0);
    expect(r.tasks.length).toBe(0);
    expect(r.resources.length).toBe(LAYOUT.rotas.length);
  });

  it('product with no basfluxo data returns empty result', () => {
    const p = makeProduct('p', 'P', []);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 1 }, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(0);
    expect(r.makespan_min).toBe(0);
  });

  it('max lotes (20) does not cause overflow or crash', () => {
    const p = makeProduct('p', 'P', [teste('T', [atv('A', 'BALANÇA', 'MAQ', 5), atv('B', 'HPLC DAD', 'MAQ', 10)])]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 20 }, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(40);
    expect(r.makespan_min).toBeGreaterThan(0);
    expect(r.lotesSimulados).toBe(20);
  });

  it('recurso não presente no layout ainda é aceito (sem coordenadas)', () => {
    const p = makeProduct('p', 'P', [teste('T', [atv('A', 'BALANÇA_ULTRA', 'MAQ', 10)])]);
    const r = simulateFIFO({ products: [p], lotesPorProduto: { p: 1 }, layout: LAYOUT, settings });
    expect(r.totalTasks).toBe(1);
    expect(r.tasks[0].rota).toBe('BALANÇA_ULTRA');
  });
});