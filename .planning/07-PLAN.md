---
phase: 7
title: Arvore de Rotas Analiticas
date: 2026-07-01
status: complete
description: Visualizacao principal em arvore de rotas, bem visual, conectando BASEFLUXO, etapas e layout fisico do laboratorio
---

# Phase 7 - Arvore de Rotas Analiticas

## Objetivo

Criar uma visualizacao nova, mais visual e mais explicativa que o diagrama atual: uma **arvore de rotas analiticas**.

Ela deve mostrar:
- o caminho da analise desde a entrada ate a consolidacao final;
- onde o fluxo bifurca por etapas paralelas;
- quais rotas/equipamentos participam;
- quanto tempo se concentra em cada trecho;
- e onde esse fluxo acontece dentro do layout real do laboratorio.

Essa fase faz sentido porque os planos anteriores ja prepararam a base para isso:
- a **Phase 6** introduziu etapas sequenciais/paralelas e previu diagrama visual;
- o quick task `260701-o6v` criou `lab-layout.json`, `SimulationView`, scheduler e mapa 2D;
- o projeto ja tem um `FlowRouteDiagram.tsx`, mas hoje ele ainda esta mais proximo de um fluxograma simples do que de uma arvore visual rica.

## O que faz sentido reaproveitar

### Do Phase 6
- `BasfluxoView.tsx` como ponto de edicao e visualizacao do fluxo
- modelo `etapas[]` com `modo: sequencial | paralelo`
- `FlowRouteDiagram.tsx` como referencia de rendering SVG

### Do quick task de layout/simulacao
- `backend/config/lab-layout.json` como mapa fisico oficial das rotas
- `frontend/services/layoutTypes.ts` para tipos do layout
- `SimulationView.tsx` como prova de que o layout ja funciona como visao espacial
- `scheduler.ts` como fonte futura para overlays de carga e gargalo real

## Decisoes travadas

| Decisao | Valor |
|---|---|
| Visual principal | Arvore de rotas |
| Visual secundario | Mini mapa no layout do laboratorio |
| Onde entra primeiro | `BasfluxoView.tsx` |
| Render | SVG puro |
| Dependencias | Nenhuma nova |
| Fonte da verdade | `BASEFLUXO` + `lab-layout.json` |
| Gantt temporal | Opcional, posterior, nao e o foco da fase |

## Como isso vai ficar

### Painel principal: arvore visual

Estrutura esperada:

```text
Entrada
  |
  +-- BALANCA
  |     |
  |     +-- ANALISTA BANCADA
  |             |
  |             +-- HPLC DAD
  |             |
  |             +-- ULTRASSOM
  |                    |
  |                    +-- ANALISTA EQUIP - HPLC
  |
  +-- DISSOLUTOR
        |
        +-- ANALISTA TF
```

Mas visualmente, em vez de texto seco:
- cada no vira um card/retangulo com cor, icone e tempo agregado;
- cada aresta vira uma conexao suave, com seta e anotacao de tempo;
- bifurcacoes paralelas ficam como galhos reais da arvore;
- convergencias voltam para um tronco comum;
- o galho mais pesado pode ganhar destaque visual de gargalo.

### Mini mapa lateral

Ao lado da arvore, um mini mapa do laboratorio:
- usando as coordenadas de `lab-layout.json`;
- destacando apenas as rotas usadas naquele teste;
- numerando a ordem de passagem;
- desenhando o caminho fisico simplificado entre as estacoes.

### KPIs acima da arvore

- `Tempo total`
- `Tempo MO`
- `Tempo MAQ`
- `Rotas envolvidas`
- `Trocas de rota`
- `Maior gargalo`
- `Economia por paralelismo`

## Diferenca para o que existe hoje

### `FlowRouteDiagram.tsx` atual
- mostra etapas e atividades em caixas;
- comunica sequencial/paralelo de forma basica;
- nao consolida bem a nocao de arvore;
- nao usa o layout do laboratorio;
- nao destaca gargalo nem percurso fisico.

### Novo objetivo do Phase 7
- transformar o diagrama em uma **visualizacao de arvore operacional**;
- ligar a arvore ao espaco fisico do laboratorio;
- preparar uma base para overlays futuros de simulacao e carga.

## Tasks

### Task 7.1 - Modelo derivado de arvore (large)

**Arquivos:** `frontend/services/routeTree.ts` (novo)

**O que faz:** Converter `etapas[]` do BASEFLUXO em uma estrutura de arvore renderizavel.

**Requisitos:**
- aceitar formato legado e formato com etapas;
- gerar `nodes`, `edges`, `branches`, `metrics`;
- marcar bifurcacao quando `modo === 'paralelo'`;
- consolidar repeticoes de rota sem perder a ordem;
- calcular:
  - `totalMin`
  - `moMin`
  - `maqMin`
  - `handoffs`
  - `bottleneckRoute`
  - `parallelSavingsMin`

**Interface sugerida:**
```ts
type RouteTreeNode = {
  id: string;
  rota: string;
  execucao: 'MO' | 'MAQ';
  atividadeLabels: string[];
  totalMin: number;
  depth: number;
  x?: number;
  y?: number;
  branchKind?: 'root' | 'seq' | 'parallel' | 'merge';
};

type RouteTreeEdge = {
  id: string;
  from: string;
  to: string;
  totalMin: number;
  sampleMin: number;
  standardMin: number;
  isCritical?: boolean;
};

type RouteTreeModel = {
  nodes: RouteTreeNode[];
  edges: RouteTreeEdge[];
  metrics: {
    totalMin: number;
    moMin: number;
    maqMin: number;
    handoffs: number;
    parallelSavingsMin: number;
    bottleneckRoute: string | null;
  };
};
```

**Verify:**
- um teste simples gera uma cadeia linear;
- um teste com etapa paralela gera galhos;
- o total do modelo bate com a heuristica atual do BASEFLUXO.

---

### Task 7.2 - Novo componente `RouteTreeDiagram.tsx` (large)

**Arquivos:** `frontend/components/flow/RouteTreeDiagram.tsx` (novo)

**O que faz:** Renderizar a arvore principal em SVG.

**Requisitos visuais:**
- no raiz com label do teste;
- nos de rota com cards arredondados;
- conexoes curvas com seta;
- paralelo = abertura horizontal em multiplos galhos;
- merge = reconvergencia clara;
- cards MO em ambar, MAQ em azul;
- highlight suave para gargalo;
- legenda visual;
- tooltips simples via `<title>`.

**Layout do desenho:**
- eixo principal horizontal ou vertical, desde que a bifurcacao fique clara;
- preferencia: raiz a esquerda e desdobramento para a direita;
- cards com largura fixa e altura adaptada ao numero de labels;
- scroll quando necessario.

**Verify:**
- a arvore fica legivel com 1, 3 e 10+ atividades;
- bifurcacao paralela nao sobrepoe labels;
- merges ficam visiveis.

---

### Task 7.3 - Mini mapa fisico acoplado ao layout (medium)

**Arquivos:** `frontend/components/flow/RouteTreeMiniMap.tsx` (novo)

**O que faz:** Mostrar o percurso fisico da arvore dentro do laboratorio usando `lab-layout.json`.

**Requisitos:**
- `fetch('/api/config/layout')` ou receber `layout` por prop;
- desenhar apenas rotas tocadas pelo teste;
- destacar ordem com numeros;
- desenhar linhas entre centros das estacoes;
- ressaltar gargalo no mapa tambem.

**Verify:**
- quando rota existe no layout, aparece no mapa;
- quando nao existe, a arvore continua funcionando e o mapa ignora essa rota com tolerancia.

---

### Task 7.4 - Integracao no `BasfluxoView.tsx` (medium)

**Arquivos:** `frontend/components/views/BasfluxoView.tsx`

**O que faz:** Substituir o modo `Diagrama` atual por uma experiencia mais rica:
- `Planilha`
- `Arvore`
- opcionalmente `Diagrama legado` temporario durante transicao

**Requisitos:**
- manter a edicao como esta;
- renderizar KPIs acima da arvore;
- renderizar `RouteTreeDiagram` + `RouteTreeMiniMap` no modo visual;
- manter compatibilidade com testes sem etapas.

**Verify:**
- toggle entre planilha e arvore funciona;
- nenhum teste quebra ao abrir visualizacao.

---

### Task 7.5 - Paleta compartilhada e semantica visual (small)

**Arquivos:** `frontend/components/flow/routeVisuals.ts` (novo), `FlowRouteDiagram.tsx`, `RouteTreeDiagram.tsx`

**O que faz:** Centralizar:
- cores por rota;
- cor por `execucao`;
- estilo do gargalo;
- estilo de aresta padrao vs amostra.

**Verify:**
- a mesma rota parece a mesma em todas as visoes;
- MO e MAQ seguem uma linguagem consistente;
- gargalo fica reconhecivel sem exagero.

## Ordem

```text
7.1 -> 7.2 -> 7.4
  |      |
  |      -> 7.5
  -> 7.3
```

## O que fica para depois

Nao incluir agora:
- animacao temporal completa dentro da arvore;
- Gantt detalhado por timeline;
- comparacao multi-produto no mesmo canvas;
- drag-and-drop de nos na arvore.

Esses pontos podem virar uma fase posterior, porque a prioridade aqui e a **clareza estrutural da rota**.

## Verificacoes

- [ ] `npm run build --prefix frontend` sem erros
- [ ] A visualizacao abre para testes simples e complexos
- [ ] Etapas paralelas aparecem como galhos reais
- [ ] O mini mapa usa o `lab-layout.json`
- [ ] Gargalo principal fica identificavel
- [ ] Nenhuma dependencia grafica nova foi adicionada

## must_haves
- truths:
  - o layout do laboratorio ja foi planejado e implementado exatamente para sustentar visoes espaciais como esta
  - a arvore deve nascer de `BASEFLUXO`, nao da simulacao
  - a simulacao pode enriquecer a arvore depois, mas nao e pre-requisito da primeira entrega
- artifacts:
  - `frontend/services/routeTree.ts`
  - `frontend/components/flow/RouteTreeDiagram.tsx`
  - `frontend/components/flow/RouteTreeMiniMap.tsx`
  - `frontend/components/views/BasfluxoView.tsx`
- key_links:
  - `frontend/components/views/BasfluxoView.tsx`
  - `frontend/components/FlowRouteDiagram.tsx`
  - `frontend/services/layoutTypes.ts`
  - `backend/config/lab-layout.json`
  - `frontend/components/views/SimulationView.tsx`
  - `docs/architecture/route-tree-ux-spec.md`
