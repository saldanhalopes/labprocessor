# LabProcessor Plus — State

## Current Phase
- **Phase:** 1 (Migração para PostgreSQL + Docker)
- **Status:** Executado ✅
- **Plan:** .planning/01-PLAN.md

## Project Structure
```
├── backend/
│   ├── server.js      → API Express (atualizado)
│   ├── postgres.js    → Camada de dados PostgreSQL
│   ├── pgvector.js    → Busca vetorial local
│   ├── auth.js        → Auth nativa (bcrypt + JWT)
│   ├── gemini.js      → Análise de documentos + chat
│   ├── chat.js        → RAG controller
│   ├── migrate.js     → Script de migração do Firestore
│   ├── db/            → Schema SQL
│   └── package.json   → Sem firebase-admin/pinecone
├── frontend/
│   ├── App.tsx        → Sem Stripe, com JWT
│   ├── components/    → Subscription simplificado
│   ├── services/      → api.ts com JWT, dbService/pineconeService
│   └── package.json   → Sem @stripe/stripe-js
├── Dockerfile         → Multi-stage
├── docker-compose.yml → App + PostgreSQL + pgvector
└── docs/              → Documentação do projeto
```

## Decisions
- PostgreSQL com pgvector substitui Firestore + Pinecone ✅
- bcrypt + JWT para auth nativa ✅
- Storage local via sistema de arquivos ✅
- Stripe removido ✅
- Docker multi-stage com docker-compose ✅
