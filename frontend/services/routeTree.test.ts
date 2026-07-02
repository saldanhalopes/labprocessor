import { describe, expect, it } from 'vitest';
import { buildRouteTree } from './routeTree';
import type { EtapaBasfluxo } from '../types';

describe('buildRouteTree', () => {
  it('builds a linear chain for sequential stages', () => {
    const etapas: EtapaBasfluxo[] = [
      {
        nome: 'Preparacao',
        modo: 'sequencial',
        ordem: 1,
        atividades: [
          { atividade: 'Pesar', rota: 'BALANCA', execucao: 'MAQ', padrao_amostra: 'Padrão', tempo_corrida_minutos: 10 },
          { atividade: 'Preparar', rota: 'ANALISTA', execucao: 'MO', padrao_amostra: 'Amostra', tempo_corrida_minutos: 5 },
        ],
      },
    ];

    const model = buildRouteTree(etapas, 'TEOR');

    expect(model.nodes.filter((node) => node.kind === 'activity')).toHaveLength(2);
    expect(model.stages).toHaveLength(1);
    expect(model.metrics.totalMin).toBe(15);
    expect(model.metrics.handoffs).toBe(1);
    expect(model.orderedRoutes).toEqual(['BALANCA', 'ANALISTA']);
  });

  it('creates parallel branches and savings for parallel stages', () => {
    const etapas: EtapaBasfluxo[] = [
      {
        nome: 'Paralela',
        modo: 'paralelo',
        ordem: 1,
        atividades: [
          { atividade: 'Ultrassom', rota: 'ULTRASSOM', execucao: 'MAQ', padrao_amostra: 'Amostra', tempo_corrida_minutos: 20 },
          { atividade: 'Dissolucao', rota: 'DISSOLUTOR', execucao: 'MAQ', padrao_amostra: 'Amostra', tempo_corrida_minutos: 30 },
        ],
      },
      {
        nome: 'Final',
        modo: 'sequencial',
        ordem: 2,
        atividades: [
          { atividade: 'Correr HPLC', rota: 'HPLC DAD', execucao: 'MAQ', padrao_amostra: 'Amostra', tempo_corrida_minutos: 90 },
        ],
      },
    ];

    const model = buildRouteTree(etapas, 'DISSOLUCAO');
    const parallelStage = model.stages[0];
    const mergeNodes = model.nodes.filter((node) => node.kind === 'merge');

    expect(parallelStage.parallelSavingsMin).toBe(20);
    expect(model.metrics.totalMin).toBe(120);
    expect(mergeNodes.length).toBeGreaterThan(0);
    expect(model.metrics.bottleneckRoute).toBe('HPLC DAD');
  });
});

