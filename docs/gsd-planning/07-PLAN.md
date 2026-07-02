# Phase 7: Planta Baixa Real como Background da Simulação — PLANO

**Data:** 2026-07-02
**Status:** Planned
**Mode:** standard

## Resumo

Substituir o fundo abstrato (zonas coloridas programáticas) da simulação 2D pela
imagem real da planta baixa do laboratório (`docs/LAYOUT 1_page-0001.jpg`),
mantendo estações e agentes sobrepostos como overlay interativo.

## Tasks

| # | Tarefa | Status |
|---|--------|--------|
| 7.1 | Servir imagem via endpoint `GET /api/config/layout-image` | ⬜ |
| 7.2 | Estender `LabLayout` com campo `backgroundImage` + atualizar JSON | ⬜ |
| 7.3 | `SimulationCanvas`: renderizar imagem como fundo do canvas | ⬜ |
| 7.4 | `LayoutEditor`: renderizar imagem como fundo + toggle | ⬜ |
| 7.5 | Ajustes visuais de opacidade/contraste | ⬜ |

## Detalhamento

### 7.1 — Servir imagem estática

- Copiar `docs/LAYOUT 1_page-0001.jpg` para `backend/config/layout-background.jpg`
- Adicionar rota `GET /api/config/layout-image` em `backend/server.js` (após linha 811):
  - `Content-Type: image/jpeg`
  - `Cache-Control: public, max-age=86400`

### 7.2 — Estender tipos do layout

- `frontend/services/layoutTypes.ts`: adicionar `backgroundImage?: string` ao `LabLayout`
- `backend/config/lab-layout.json`: adicionar `"backgroundImage": "/api/config/layout-image"`
- Campo opcional garante backward compatibility

### 7.3 — SimulationCanvas com background

- `drawScene()`: receber `HTMLImageElement | null`, desenhar como primeira camada
- Camadas de renderização:
  1. `ctx.drawImage(bgImg, 0, 0, W, H)` — planta real (fundo)
  2. Zonas com alpha reduzido (0.15 → 0.06) — overlay de referência
  3. Estações (rotas) — interativas, mesmas cores
  4. Agentes animados — sem alteração
- Carregar imagem via `new Image()` no `useEffect`, estado `bgImage`

### 7.4 — LayoutEditor com background

- Mesma lógica de camadas do SimulationCanvas
- Checkbox toggle "Mostrar planta de fundo" (estado `showBackground`, default true)
- Drag-and-drop de estações funcional com e sem fundo

### 7.5 — Ajustes visuais

- Aumentar `shadowBlur`/`shadowColor` nas estações ocupadas para destaque
- Texto das estações: `bold 12px` branco mantido
- Fundo do canvas trocar de `#f8fafc` para imagem

## Verificação

- [ ] Simulação 2D exibe a planta real como fundo do canvas
- [ ] Zonas aparecem como overlay semi-transparente sobre a planta
- [ ] Estações (rotas) visíveis e com hit-test funcional
- [ ] Agentes animam corretamente sobre a planta
- [ ] LayoutEditor mostra/oculta fundo com toggle
- [ ] Drag-and-drop funciona com e sem fundo visível
- [ ] Fallback: se `backgroundImage` ausente, comportamento atual preservado

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Dimensões da imagem != canvas (1080x620) | `drawImage` com scale to fit; ou ajustar canvas às dimensões reais |
| Imagem 1.4MB lenta em redes lentas | Cache-Control de 24h |
| Contraste insuficiente nas estações | Ajustar alpha das zonas + shadow nas estações |

## Arquivos Modificados

- `backend/server.js` — endpoint `/api/config/layout-image`
- `backend/config/lab-layout.json` — campo `backgroundImage`
- `frontend/services/layoutTypes.ts` — interface `LabLayout`
- `frontend/components/simulation/SimulationCanvas.tsx` — renderização do fundo
- `frontend/components/settings/LayoutEditor.tsx` — renderização do fundo + toggle

## Arquivos Movidos

- `docs/LAYOUT 1_page-0001.jpg` → `backend/config/layout-background.jpg`
