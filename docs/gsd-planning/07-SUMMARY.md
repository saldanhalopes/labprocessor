# Phase 7: Planta Baixa Real como Background da Simulação - SUMMARY

## Objetivo entregue

Substituição do fundo abstrato da simulação 2D pela planta baixa real do laboratório, mantendo zonas, estações e agentes como camadas interativas sobre a imagem.

## O que foi implementado

- Endpoint `GET /api/config/layout-image` em `backend/server.js`
- Imagem copiada para `backend/config/layout-background.jpg`
- Campo opcional `backgroundImage` adicionado ao contrato `LabLayout`
- `backend/config/lab-layout.json` atualizado para apontar para `/api/config/layout-image`
- `SimulationCanvas` atualizado para desenhar a planta como primeira camada
- `LayoutEditor` atualizado para desenhar a planta e permitir toggle de visibilidade
- Ajustes visuais de opacidade das zonas e destaque de estações ocupadas

## Completion audit

### 1. Restate

Entregar uma simulação 2D com planta real como fundo, preservando:
- compatibilidade com layouts sem imagem;
- interatividade das estações;
- animação dos agentes;
- edição visual do layout com fundo opcional.

### 2. Checklist das truths

- `Simulação 2D exibe a planta real como fundo do canvas`
  - Evidência: `frontend/components/simulation/SimulationCanvas.tsx` usa `drawImage` antes das demais camadas

- `Zonas aparecem como overlay semi-transparente sobre a planta`
  - Evidência: `SimulationCanvas.tsx` mantém o desenho das zonas com alpha reduzido para `0.06`

- `Estações visíveis e com hit-test funcional`
  - Evidência: a área clicável continua baseada em `layout.rotas`, sem mudança no hit-test

- `Agentes animam corretamente sobre a planta`
  - Evidência: agentes seguem sendo desenhados depois das estações, sem alteração na lógica de animação

- `LayoutEditor mostra/oculta fundo com toggle`
  - Evidência: `frontend/components/settings/LayoutEditor.tsx` adiciona `showBackground` com checkbox "Mostrar planta de fundo"

- `Drag-and-drop funciona com e sem fundo visível`
  - Evidência: o drag continua operando por coordenadas do canvas; o fundo só altera a renderização

- `Fallback preservado quando backgroundImage ausente`
  - Evidência: ambos os canvases preenchem com `#f8fafc` quando `layout.backgroundImage` não existe ou falha ao carregar

### 3. Inspect

- Build executado: `npm run build`
- Resultado: build do frontend concluído com sucesso
- Inspeção de diff concluída nos arquivos de backend, tipos e canvases

### 4. Gaps

- Não houve validação visual automatizada em navegador nesta execução
- O backend não teve teste HTTP dedicado para o endpoint novo
- Não são gaps bloqueantes para o escopo atual, mas ainda valem como próximos passos de verificação manual

### 5. Continue / stop

- Sem gaps bloqueantes para a entrega do plano

### 6. Complete

- Phase 7 implementada no código
- Summary escrito em `docs/gsd-planning/07-SUMMARY.md`
- Pronta para revisão visual e commit

## Verificação final

- [x] `npm run build`
- [x] Endpoint e asset de fundo adicionados
- [x] Contrato `LabLayout` atualizado com campo opcional
- [x] Simulação desenha planta + overlay + estações + agentes
- [x] Editor mostra/oculta planta de fundo
- [x] Fallback preservado sem `backgroundImage`
