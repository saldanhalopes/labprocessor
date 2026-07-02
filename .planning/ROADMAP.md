# LabProcessor Plus — Roadmap

## Phase 1: Migração para PostgreSQL + Docker
**Goal:** Substituir Firebase/Pinecone/GCS/Stripe por PostgreSQL + pgvector + storage local + auth nativa + Docker
**Status:** Planned
**Mode:** standard

---

## Phase 2: Integração MFVCQ no Frontend + Chat
**Goal:** Criar UI para análise MFVCQ, integrar chat RAG e pipeline de upload
**Status:** Planned
**Mode:** standard

## Phase 3: Sistema de Conhecimento Obsidian + Segundo Cérebro (Aprendizado)
**Goal:** Vault Obsidian com 1.900+ notas, motor de similaridade, auto-aprendizado, detecção de padrões, calibração de heurísticas e consolidação de conhecimento
**Status:** In Progress (Wave 1 complete, Wave 2 planned)
**Mode:** standard

## Phase 4: Refatoração da Tabela de Atividades na View
**Goal:** Corrigir HTML inválido (tabela dentro de `<td>`), expandir edição inline de todos os campos de atividades e aplicar correções visuais/UI em todos os produtos da aba View
**Status:** Planned
**Mode:** standard

---

## Phase 5: Consolidação pgvector + mem0 + Gemini + Obsidian Vault
**Goal:** Integrar os 4 componentes em pipeline coeso: vault Obsidian vetorizado no pgvector, mem0 participando da busca semântica, chat RAG enriquecido com mem0, busca unificada no frontend
**Status:** In Progress (implemented, pending verification)
**Mode:** standard

---

## Phase 6: Organização do BASEFLUXO
**Goal:** Extrair BASEFLUXO para aba dedicada com planilha estilo Excel, modelo de etapas (sequencial/paralelo) e diagrama visual de fluxo
**Status:** In Progress
**Mode:** standard

---

## Phase 7: Arvore de Rotas Analiticas
**Goal:** Criar visualizacao principal em arvore de rotas, conectando BASEFLUXO, etapas paralelas e layout fisico do laboratorio
**Status:** Completed
**Mode:** standard

---

## Future Phases (não planejadas)

- **Phase 8:** Testes automatizados (unitários + integração)
- **Phase 9:** CI/CD pipeline
- **Phase 10:** Melhorias de segurança
