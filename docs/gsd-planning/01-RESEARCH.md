# Phase 1: Migração para PostgreSQL + Docker — Pesquisa

**Arquivado em:** 2026-06-19
**Original:** `.planning/01-RESEARCH.md`

## Stack Final

| Camada | Tecnologia |
|--------|-----------|
| Database | PostgreSQL 16 + pgvector |
| Vector DB | pgvector (extensão PG) |
| Storage | Sistema de arquivos local |
| Auth | bcrypt + JWT |
| Deploy | Docker + docker-compose |
| Embeddings | Gemini Embedding API (mantido) |

## Modelo de Dados

8 tabelas: `users`, `results`, `analysis_rows`, `reagents`, `standards`, `equipments`, `embeddings`
Extensão `vector` para busca semântica com índice ivfflat (cosine, lists=100).

## Riscos Identificados

1. Perda de dados na migração → script migrate.js criado
2. Performance de embeddings 3072-dim → ivfflat index
3. Quebra de API contracts → mesmas assinaturas de função mantidas
4. Senhas plain text → bcrypt + JWT implementados
