# LabProcessor Plus — Documentação

## Estrutura

```
docs/
├── README.md                  ← Este índice
├── gsd-planning/              ← Artefatos GSD (planos, pesquisas, roadmaps)
│   ├── 01-PLAN.md             → Plano de Migração para PostgreSQL + Docker
│   ├── 01-RESEARCH.md         → Pesquisa técnica da migração
│   ├── ROADMAP.md             → Roadmap do projeto
│   └── STATE.md               → Estado atual do projeto
├── architecture/              ← Documentação arquitetural
│   ├── stack.md               → Stack e topologia do sistema
│   └── route-tree-ux-spec.md  → UX da árvore de rotas analíticas
└── changelog/                 ← Histórico de mudanças
    └── 2026-06-19.md          → Changelog do dia
```

## Como usar

- **Sempre** documente aqui quando executar comandos GSD
- Arquive os planos executados em `docs/gsd-planning/`
- Atualize o changelog diário em `docs/changelog/`
- Use `gitnexus` para contexto ao documentar

## Links

- [GitHub](https://github.com/saldanhalopes/labprocessor.git)
- [Plano Fase 1](gsd-planning/01-PLAN.md)
- [Pesquisa Fase 1](gsd-planning/01-RESEARCH.md)
- [UX Spec da Árvore de Rotas](architecture/route-tree-ux-spec.md)
