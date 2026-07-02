# LabProcessor Plus — State

## Current Phase
- **Phase:** 7 (Arvore de Rotas Analiticas)
- **Status:** Completed
- **Plan:** 07-PLAN.md

## Previous Phase
- **Phase:** 7 (Arvore de Rotas Analiticas)
- **Status:** Completed

## Completed Phases
- Phase 1: Migração PostgreSQL + Docker (planned)
- Phase 2: Integração MFVCQ no Frontend + Chat (planned)
- Phase 3: Sistema Obsidian + Segundo Cérebro (Wave 1 complete, Wave 2 planned)
- Phase 4: Refatoração Tabela de Atividades (planned)
- **Phase 5: Consolidação pgvector + mem0 + Gemini + Obsidian Vault** (just implemented)
- **Phase 7: Arvore de Rotas Analiticas** (implemented)

## Phase 5 Changes Summary

| File | Change |
|---|---|
| `backend/pgvector.js` | `saveToPinecone` → `saveToPgVector`, batch insert via `unnest`, `generateEmbedding` exported, HNSW `ef_search` |
| `backend/server.js` | Import rename, `/api/pinecone/sync` → `/api/pgvector/sync`, new `/api/search/unified` endpoint |
| `backend/sync-embeddings.js` | Import rename |
| `backend/chat.js` | Enriched with mem0 context before LLM call |
| `backend/mem0-client.js` | `remember()` accepts structured JSON metadata |
| `backend/knowledge.js` | `searchVault()` for pgvector semantic search, `findSimilarHybrid()`, pg pool |
| `backend/build-vault.cjs` | `--embeddings` and `--embeddings-only` flags |
| `backend/db/schema.sql` | `vault_embeddings` table, HNSW indexes for embeddings + vault_embeddings |
| `frontend/services/pineconeService.ts` | Renamed to `pgvectorService.ts`, endpoint updated |
| `frontend/components/views/KnowledgeView.tsx` | Unified search bar with mem0 + vault + documents results |
| `.planning/05-RESEARCH.md` | Research document |
| `.planning/05-PLAN.md` | Implementation plan |

## Architecture

```
OpenRouter (unified API gateway)
├── Chat: google/gemini-2.5-flash
└── Embeddings: openai/text-embedding-3-large (3072d)
         │
    ┌─────┴──────┐
    │ pgvector.js │──> PostgreSQL + pgvector + HNSW
    └─────┬──────┘       ├── embeddings (PDF chunks)
          │              └── vault_embeddings (Obsidian notes)
    ┌─────┴──────┐
    │ knowledge.js│──> Obsidian vault (.md) + searchVault()
    └─────┬──────┘
          │
    ┌─────┴──────┐
    │ mem0-client │──> Self-hosted mem0 REST API
    └─────┬──────┘
          │
    POST /api/search/unified → mem0 + vault + documents
```

## Decisions
- OpenRouter mantido como gateway único para chat + embeddings
- Embeddings: `openai/text-embedding-3-large` (3072d) — Gemini embedding não disponível no OpenRouter
- HNSW substitui ivfflat (incompatível com dim 3072)
- mem0 registra metadados JSON estruturados em vez de strings simples
- `findSimilar()` textual mantido; `searchVault()` adicionado como busca semântica complementar

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260701-o6v | Fase 1 Schema Layout: lab-layout.json + rotas /api/config/layout + LayoutEditor drag-drop | 2026-07-01 | 2ee071b | [260701-o6v-fase-1-schema-layout-backend-config-lab-](./quick/260701-o6v-fase-1-schema-layout-backend-config-lab-/) |
| 260701-o6v-f2 | Fase 2 DES FIFO Scheduler + vitest (scheduler.ts + 10 tests pass) | 2026-07-01 | 89ca3a3 | [same quick task as Fase 1](./quick/260701-o6v-fase-1-schema-layout-backend-config-lab-/) |
| 260701-o6v-f3 | Fase 3 Canvas 2D Animation Engine (agents + SimulationCanvas rAF + 7 tests) | 2026-07-01 | 8b1e836 | [same quick task as Fase 1](./quick/260701-o6v-fase-1-schema-layout-backend-config-lab-/) |
| 260701-o6v-f4 | Fase 4 SimulationView + Dashboard tab integration (i18n pt/es/en + KPIs + 17 tests) | 2026-07-01 | bea5121 | [same quick task as Fase 1](./quick/260701-o6v-fase-1-schema-layout-backend-config-lab-/) |
| 260701-o6v-f5 | Fase 5 Polish: edge-cases empty/max lotes, layout retry, eligible count, 21 tests, closure fix | 2026-07-01 | 62f0226 | [same quick task as Fase 1](./quick/260701-o6v-fase-1-schema-layout-backend-config-lab-/) |

Last activity: 2026-07-01 - Completed quick task 260701-o6v all 5 fases: visualização 2D lab completa
