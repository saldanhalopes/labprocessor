# Análise Detalhada das Planilhas

## 1. BASEFLUXOTEMPOANALISE.xlsx - Base de Fluxo de Tempo de Análise

### Objetivo
Mapear o **fluxo de atividades de Controle de Qualidade (CQ)** com seus respectivos **tempos de corrida (TC)** para análises de produtos farmacêuticos.

### Estrutura de Dados

#### Aba: BD _TC GERAL (466 registros)
Esta é a base de verdade que contém o mapeamento completo de análises.

**Colunas:**
1. **CONCAT CÓD & MÁQ**: Identificador único concatenado
2. **ATIVO**: Nome do princípio ativo (ex: ABIRATERONA)
3. **ANÁLISE CQ**: Tipo de análise (Bulk, Produto Acabado)
4. **FORMA FARMACÊUTICA**: Sólidos, Líquidos, Injetáveis, etc.
5. **TESTE**: Tipo de teste realizado (TEOR HPLC 1, DEGRADAÇÃO, DISSOLUÇÃO, etc.)
6. **SIMILARIDADE**: Classificação de similaridade (MESMO HPLC 1, NÃO APLICÁVEL, etc.)
7. **ROTA**: Equipamento/Método utilizado (HPLC DAD, HPLC UV, DISSOLUTOR, etc.)
8. **ATIVIDADES**: Descrição específica da atividade (ex: "Tempo de corrida das Padrão Calibração")
9. **PADRÃO/AMOSTRA**: Tipo de amostra (Padrão ou Amostra)
10. **MO/MAQ**: Execução manual (MO) ou por máquina (MAQ)
11. **TC (Tempo de Corrida)**: Tempo em minutos para execução

#### Aba: BASE FLUXO ANALISE (466 registros)
Complementa a primeira aba com informações de atividades de suporte.

**Estrutura similar** com foco em atividades de movimentação, preparação e suporte.

### Dados Únicos Identificados

| Dimensão | Quantidade | Exemplos |
|----------|-----------|----------|
| **ATIVOS** | 1 | ABIRATERONA |
| **ANÁLISES CQ** | 1 | Bulk |
| **FORMAS FARMACÊUTICAS** | 1 | Sólidos |
| **TESTES** | 11 | TEOR HPLC 1, DEGRADAÇÃO, DISSOLUÇÃO, DESINTEGRAÇÃO, DUREZA, etc. |
| **ROTAS** | 19 | HPLC DAD, HPLC UV, DISSOLUTOR, DESINTEGRADOR, BALANÇA, etc. |
| **PADRÃO/AMOSTRA** | 3 | Padrão, Amostra, Padrão (com espaço) |
| **MO/MAQ** | 2 | MO (Manual), MAQ (Máquina) |

### Padrão de Fluxo

```
ATIVO (ex: ABIRATERONA)
  ├─ FORMA FARMACÊUTICA (Sólidos)
  │   ├─ TESTE (TEOR HPLC 1)
  │   │   ├─ SIMILARIDADE (MESMO HPLC 1)
  │   │   │   ├─ ROTA (HPLC DAD)
  │   │   │   │   ├─ ATIVIDADE (Tempo de corrida das Padrão Calibração)
  │   │   │   │   │   ├─ PADRÃO/AMOSTRA (Padrão)
  │   │   │   │   │   ├─ MO/MAQ (MAQ)
  │   │   │   │   │   └─ TC (350 min)
```

---

## 2. MFVCQ_Oficial-DEMANDAATUALIZADAFEVMARABR2024.xlsb - Demanda Atualizada

### Objetivo
Mapear a **demanda de produtos** (Bulk e Produto Acabado) com cálculos de **capacidade, setup, tempo de equipamento e células de produção**.

### Estrutura de Dados

#### Aba: DEMANDA (1573 registros)
Base de demanda de produtos com informações de conversão e histórico.

**Colunas principais:**
1. **Centro**: Centro de distribuição
2. **Código**: Código do produto acabado
3. **CÓDIGO Bulk**: Código do bulk correspondente
4. **Descrição**: Descrição completa do produto
5. **CÓD ANÁLISE CQ**: Código da análise CQ
6. **ANÁLISE CQ**: Tipo (Produto acabado ou Bulk)
7. **TEM DEMANDA?**: SIM/NÃO
8. **SÓLIDO?**: Classificação de forma farmacêutica
9. **ATIVO**: Nome do princípio ativo
10. **Contemplado no PMP?**: Referência ao PMP
11. **Observação**: Notas adicionais
12. **Média 12 Meses**: Demanda média mensal
13. **Fator de Conversão**: Multiplicador para conversão
14. **Demanda Convertida**: Demanda após conversão
15. **Tamanho do Bulk**: Quantidade por lote
16. **Tamanho Lote PA**: Tamanho do lote de produto acabado
17. **Demanda em Lotes**: Quantidade de lotes necessários
18. **Demanda em Lotes Bulk**: Quantidade de lotes de bulk
19. **Historico Entr**: Histórico de entrada
20. **HIST. MÉD. MÊS**: Histórico médio mensal
21. **P/R**: Planejamento/Realizado
22. **Célula**: Célula de produção responsável
23. **HISTORICO DEMANDA (LOTES) ANTERIOR**: Demanda anterior
24. **DIFERENCA PARA ATUAL**: Diferença em relação à demanda anterior

#### Outras Abas Importantes

| Aba | Registros | Propósito |
|-----|-----------|----------|
| **BD _TC GERAL** | 79.433 | Base de dados completa de tempos de corrida (similar à BASEFLUXO) |
| **SEPARAÇÃO DE AM** | 775 | Separação de amostras com cálculo de carga |
| **CM AM + SETUP** | 22 | Capacidade de máquina + setup por família |
| **TC GERAL MO** | ? | Tempos gerais de mão de obra |
| **CAP C HOMEM - FAMÍLIA** | ? | Capacidade de homem por família |
| **FAMÍLIAS** | ? | Classificação de famílias de produtos |
| **TC GERAL MAQ** | ? | Tempos gerais de máquina |
| **CAP C MAQ OTM** | ? | Capacidade otimizada de máquina |

### Dados Únicos Identificados

| Dimensão | Quantidade | Exemplos |
|----------|-----------|----------|
| **PRODUTOS (ATIVOS)** | 274 | TRAMADOL + PAR, ASTRO/AZITROMICINA CP, SELENE, CELECOXIBE, ALPRAZOLAM, etc. |
| **ANÁLISES CQ** | 2 | Produto acabado, Bulk |
| **CÉLULAS** | 10 | SÓLIDOS 1, SÓLIDOS 2 e 5, SÓLIDOS 3 e 4, INJETÁVEIS e ONCOLÓGICOS, SUSP/LIQ/CR/POM I, II e III, HORMONIOS, ANÁLISE EXTERNA, PRODUTO PRONTO, NOEX/VERSA/HEPTAR, 0x2a |

### Padrão de Demanda

```
PRODUTO (ex: TRAMADOL + PAR)
  ├─ CÓDIGO (ex: 412440)
  ├─ CÓDIGO BULK (ex: 107179)
  ├─ ATIVO (ex: TRAMADOL)
  ├─ ANÁLISE CQ (Produto acabado ou Bulk)
  ├─ FORMA FARMACÊUTICA (Sólidos)
  ├─ CÉLULA (ex: SÓLIDOS 2 e 5)
  ├─ Média 12 Meses (ex: 12.416,67 unidades)
  ├─ Fator de Conversão (ex: 2)
  ├─ Demanda Convertida (ex: 24.833,33 unidades)
  ├─ Tamanho do Bulk (ex: 611 unidades)
  ├─ Tamanho Lote PA (ex: 305,5 unidades)
  ├─ Demanda em Lotes (ex: 48,77 lotes)
  └─ Demanda em Lotes Bulk (ex: 48,77 lotes)
```

---

## 3. Relação entre as Planilhas

### Mapeamento Cruzado

```
BASEFLUXO (Base de Verdade - Fluxo)
    ↓
    Contém: ATIVO + TESTE + ROTA + TC
    ↓
MFVCQ (Consulta - Demanda)
    ↓
    Usa: ATIVO + CÉLULA para calcular capacidade
    ↓
    Resultado: Demanda em Lotes × TC = Tempo Total Necessário
```

### Chaves de Relacionamento

| BASEFLUXO | MFVCQ | Relacionamento |
|-----------|-------|----------------|
| ATIVO | ATIVO | Identificação do produto |
| FORMA FARMACÊUTICA | SÓLIDO? | Classificação de forma |
| TESTE | ANÁLISE CQ | Tipo de análise |
| ROTA | CÉLULA | Equipamento/célula responsável |
| TC | - | Tempo necessário por atividade |
| - | Demanda em Lotes | Multiplicador para cálculo total |

---

## 4. Padrões Identificados para Reutilização em Skills

### 4.1 Estrutura Hierárquica de Produtos

Todos os produtos seguem este padrão:

```json
{
  "ativo": "Nome do Princípio Ativo",
  "codigo_pa": "Código do Produto Acabado",
  "codigo_bulk": "Código do Bulk",
  "forma_farmaceutica": "Sólidos|Líquidos|Injetáveis|Suspensões|Cremes|Pomadas",
  "celula": "Célula de Produção",
  "demanda_media_mensal": 12416.67,
  "fator_conversao": 2.0,
  "tamanho_bulk": 611,
  "tamanho_lote_pa": 305.5,
  "demanda_em_lotes": 48.77,
  "analises_cq": [
    {
      "tipo": "Bulk|Produto Acabado",
      "teste": "TEOR HPLC 1|DEGRADAÇÃO|DISSOLUÇÃO|etc",
      "similaridade": "MESMO HPLC 1|NÃO APLICÁVEL|etc",
      "rota": "HPLC DAD|HPLC UV|DISSOLUTOR|etc",
      "atividades": [
        {
          "descricao": "Tempo de corrida das Padrão Calibração",
          "tipo_amostra": "Padrão|Amostra",
          "execucao": "MO|MAQ",
          "tempo_corrida_minutos": 350
        }
      ]
    }
  ]
}
```

### 4.2 Regras de Negócio

1. **Demanda em Lotes** = Demanda Convertida / Tamanho do Bulk
2. **Demanda Convertida** = Média 12 Meses × Fator de Conversão
3. **Tempo Total de Análise** = Σ(TC de todas as atividades) × Demanda em Lotes
4. **Célula** é determinada pela Forma Farmacêutica e Tipo de Análise

### 4.3 Mapeamento de Formas Farmacêuticas para Células

```json
{
  "Sólidos": ["SÓLIDOS 1", "SÓLIDOS 2 e 5", "SÓLIDOS 3 e 4"],
  "Líquidos": ["SUSP/LIQ/CR/POM I, II e III"],
  "Injetáveis": ["INJETÁVEIS e ONCOLÓGICOS"],
  "Hormônios": ["HORMONIOS"],
  "Análise Externa": ["ANÁLISE EXTERNA"],
  "Produto Pronto": ["PRODUTO PRONTO"]
}
```

---

## 5. Recomendações para Estrutura de Skills

### Skill 1: `produto-analyzer`
- **Entrada**: Nome do novo produto, código, forma farmacêutica
- **Processamento**: Buscar na BASEFLUXO todas as análises aplicáveis
- **Saída**: JSON com fluxo de análises e tempos

### Skill 2: `demanda-calculator`
- **Entrada**: Produto + demanda média mensal + fator de conversão
- **Processamento**: Calcular demanda em lotes, tempo total necessário
- **Saída**: JSON com cálculos de demanda

### Skill 3: `fluxo-generator`
- **Entrada**: Dados do produto (skill 1 + skill 2)
- **Processamento**: Gerar documentação de fluxo completo
- **Saída**: Documento markdown com cronograma

### Skill 4: `capacidade-validator`
- **Entrada**: Demanda calculada + capacidade da célula
- **Processamento**: Validar se há capacidade disponível
- **Saída**: Relatório de viabilidade

---

## 6. Próximos Passos

1. **Confirmar** o padrão de entrada para novos produtos
2. **Definir** quais informações devem ser geradas automaticamente
3. **Estruturar** as skills com templates reutilizáveis
4. **Criar** base de dados JSON com toda a informação das planilhas
5. **Implementar** validações e regras de negócio
