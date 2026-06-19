# Phase 1: Migração para PostgreSQL + Docker — PLANO

**Data:** 2026-06-19
**Status:** Executado
**Ver:** [Plano Original (.planning/01-PLAN.md)](../../.planning/01-PLAN.md)

## Resumo

Migração completa do stack de cloud (Firebase/Firestore/Pinecone/GCS/Stripe)
para stack local auto-contido (PostgreSQL/pgvector/filesystem/bcrypt-JWT/Docker).

## Tasks

| # | Tarefa | Status |
|---|--------|--------|
| 1.1 | Schema PostgreSQL | ✅ |
| 1.2 | Camada postgres.js | ✅ |
| 1.3 | Auth bcrypt + JWT | ✅ |
| 1.4 | pgvector (vector DB) | ✅ |
| 1.5 | Storage local | ✅ |
| 1.6 | Remover Stripe | ✅ |
| 1.7 | Frontend JWT | ✅ |
| 1.8 | Docker | ✅ |
| 1.9 | Script migração | ✅ |
| 1.10 | Cleanup | ✅ |

## Arquivos Modificados

- `backend/package.json` — deps: firebase-admin/pinecone removidos, pg/bcryptjs/jsonwebtoken adicionados
- `backend/server.js` — imports atualizados, storage local, auth JWT
- `frontend/package.json` — @stripe/stripe-js removido
- `frontend/App.tsx` — Stripe handler removido, JWT session
- `frontend/components/Login.tsx` — token passado no login
- `frontend/components/Subscription.tsx` — simplificado (sem Stripe)
- `frontend/types.ts` — User type simplificado
- `frontend/services/dbService.ts` — JWT headers
- `frontend/services/pineconeService.ts` — JWT headers

## Arquivos Criados

- `backend/postgres.js`, `backend/pgvector.js`, `backend/auth.js`
- `backend/db/schema.sql`, `backend/db/init.sql`
- `backend/migrate.js`
- `frontend/services/api.ts`
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`

## Arquivos Removidos

- `backend/firestore.js`, `backend/pinecone.js`, `backend/utils/imageExtractor.js`
- `firebase.json`, `apphosting.yaml`, `.firebaserc`
