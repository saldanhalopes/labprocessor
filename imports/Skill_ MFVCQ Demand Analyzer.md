# Skill: MFVCQ Demand Analyzer

## Metadados da Skill

```yaml
name: mfvcq-demand-analyzer
version: 1.0
description: Analisar, calcular e gerar fluxos de Controle de Qualidade (CQ) e projeções de demanda para produtos farmacêuticos novos e existentes
domain: Farmacêutica / Controle de Qualidade
use_cases:
  - Adicionar novo produto ao sistema
  - Calcular tempos de análise (TC)
  - Determinar células de produção
  - Gerar relatórios de capacidade
  - Projetar demanda mensal
author: Manus AI
created: 2026-06-19
```

---

## 1. Visão Geral

A skill **MFVCQ Demand Analyzer** fornece conhecimento e ferramentas para gerenciar o fluxo de Controle de Qualidade (CQ) e a demanda de produtos farmacêuticos. Ela foi construída a partir da análise de duas planilhas oficiais:

1. **BASEFLUXOTEMPOANALISE.xlsx** - Base de verdade com fluxos de CQ
2. **MFVCQ_Oficial-DEMANDAATUALIZADAFEVMARABR2024.xlsb** - Consulta de demanda

### Dados Disponíveis

| Dimensão | Quantidade | Exemplos |
|----------|-----------|----------|
| **Ativos** | 2+ | ABIRATERONA, ACETILCISTEINA, TRAMADOL, LOSARTANA |
| **Produtos** | 1.571 | HEMOLENTA, SELENE, CELECOXIBE, ALPRAZOLAM |
| **Formas Farmacêuticas** | 6 | Sólidos, Líquidos, Injetáveis, Suspensões, Cremes, Pomadas |
| **Testes** | 12+ | TEOR HPLC, DEGRADAÇÃO, DISSOLUÇÃO, DESINTEGRAÇÃO |
| **Rotas** | 20+ | HPLC DAD, HPLC UV, DISSOLUTOR, DESINTEGRADOR |
| **Células** | 10 | SÓLIDOS 1, SÓLIDOS 2 e 5, INJETÁVEIS e ONCOLÓGICOS |

---

## 2. Estrutura de Dados

### 2.1 Hierarquia de Fluxo (BASEFLUXO)

```
ATIVO
  ├─ FORMA FARMACÊUTICA
  │   ├─ TESTE
  │   │   ├─ SIMILARIDADE
  │   │   │   ├─ ROTA
  │   │   │   │   ├─ ATIVIDADE
  │   │   │   │   │   ├─ PADRÃO/AMOSTRA
  │   │   │   │   │   ├─ EXECUÇÃO (MO/MAQ)
  │   │   │   │   │   └─ TEMPO (minutos)
```

**Exemplo Real**:
```
ABIRATERONA (Bulk, Sólidos)
  ├─ TEOR HPLC 1
  │   ├─ Tempo de corrida das Padrão Calibração (MAQ, 350 min)
  │   ├─ Tempo de corrida das amostras (MAQ, 140 min)
  │   └─ Tempo de corrida das Padrão Controle (MAQ, 140 min)
  ├─ DEGRADAÇÃO HPLC 1
  │   ├─ Single do Padrão (MAQ, 210 min)
  │   └─ Tempo de corrida das amostras (MAQ, 70 min)
```

### 2.2 Hierarquia de Demanda (MFVCQ)

```
PRODUTO
  ├─ CÓDIGO
  ├─ ATIVO
  ├─ FORMA FARMACÊUTICA
  ├─ CÉLULA DE PRODUÇÃO
  ├─ DEMANDA MÉDIA (12 meses)
  ├─ FATOR DE CONVERSÃO
  ├─ TAMANHO DO BULK
  └─ DEMANDA EM LOTES
```

**Exemplo Real**:
```
HEMOLENTA 5000ML BO CX (2)
  ├─ Código: 412440
  ├─ Ativo: HEMOLENTA
  ├─ Forma: Sólidos
  ├─ Célula: SÓLIDOS 2 e 5
  ├─ Demanda Média: 12.416,67 unidades/mês
  ├─ Fator: 2
  ├─ Tamanho Bulk: 611 unidades
  └─ Demanda em Lotes: 48,77 lotes
```

---

## 3. Regras de Negócio

### 3.1 Cálculos Fundamentais

**1. Demanda Convertida**
```
Demanda Convertida = Média 12 Meses × Fator de Conversão
```

**2. Demanda em Lotes**
```
Demanda em Lotes = Demanda Convertida / Tamanho do Bulk
```

**3. Tempo Total de Análise (TC)**
```
TC Total = Σ(Tempo de cada atividade do fluxo)
```

**4. Carga de Trabalho**
```
Carga = Demanda em Lotes × TC Total
```

### 3.2 Mapeamento de Células

O sistema mapeia automaticamente a forma farmacêutica para a célula de produção:

| Forma Farmacêutica | Células Possíveis |
|-------------------|------------------|
| **Sólidos** | SÓLIDOS 1, SÓLIDOS 2 e 5, SÓLIDOS 3 e 4 |
| **Líquidos** | SUSP/LIQ/CR/POM I, II e III |
| **Injetáveis** | INJETÁVEIS e ONCOLÓGICOS |
| **Hormônios** | HORMONIOS |
| **Análise Externa** | ANÁLISE EXTERNA |
| **Produto Pronto** | PRODUTO PRONTO |

### 3.3 Tipos de Execução

- **MO (Manual)**: Realizado por analista/operador
- **MAQ (Máquina)**: Realizado por equipamento automatizado

---

## 4. Casos de Uso

### Caso 1: Adicionar Novo Produto

**Entrada**:
```json
{
  "ativo": "NOVO_ATIVO",
  "forma_farmaceutica": "Sólidos",
  "media_12_meses": 10000,
  "fator_conversao": 2,
  "tamanho_bulk": 500
}
```

**Processamento**:
1. Buscar fluxo do ativo na base BASEFLUXO
2. Selecionar atividades aplicáveis à forma farmacêutica
3. Calcular tempo total de análise (TC)
4. Calcular demanda em lotes
5. Determinar célula de produção
6. Calcular carga de trabalho

**Saída**:
```json
{
  "ativo": "NOVO_ATIVO",
  "forma_farmaceutica": "Sólidos",
  "celula": "SÓLIDOS 1",
  "demanda": {
    "media_12_meses": 10000,
    "fator_conversao": 2,
    "demanda_convertida": 20000,
    "tamanho_bulk": 500,
    "demanda_em_lotes": 40
  },
  "analises_cq": [
    {
      "teste": "TEOR HPLC 1",
      "rota": "HPLC DAD",
      "tempo_total_minutos": 630,
      "atividades": [...]
    }
  ],
  "resumo_tempos": {
    "tempo_unitario_minutos": 4080.64,
    "tempo_unitario_horas": 68.01,
    "tempo_total_lotes_minutos": 163225.63,
    "tempo_total_lotes_horas": 2720.43
  }
}
```

### Caso 2: Consultar Fluxo de Produto Existente

**Entrada**:
```json
{
  "ativo": "ABIRATERONA",
  "forma_farmaceutica": "Sólidos"
}
```

**Saída**:
```json
{
  "ativo": "ABIRATERONA",
  "forma_farmaceutica": "Sólidos",
  "testes_aplicaveis": [
    "TEOR HPLC 1",
    "DEGRADAÇÃO HPLC 1",
    "DISSOLUÇÃO HPLC 1",
    "DESINTEGRAÇÃO",
    "DUREZA",
    ...
  ],
  "tempo_total_minutos": 4080.64,
  "tempo_total_horas": 68.01
}
```

### Caso 3: Gerar Relatório de Capacidade

**Entrada**:
```json
{
  "celula": "SÓLIDOS 2 e 5",
  "periodo": "mensal"
}
```

**Saída**:
```json
{
  "celula": "SÓLIDOS 2 e 5",
  "capacidade_total_horas": 528,
  "produtos": [
    {
      "ativo": "HEMOLENTA",
      "carga_horas": 48.77,
      "percentual_ocupacao": 9.2
    },
    {
      "ativo": "TRAMADOL",
      "carga_horas": 125.3,
      "percentual_ocupacao": 23.7
    }
  ],
  "ocupacao_total": 45.2,
  "capacidade_disponivel": 54.8
}
```

---

## 5. Implementação

### 5.1 Estrutura de Dados em JSON

**Arquivo: basefluxo_estruturado.json**
```json
{
  "ABIRATERONA": {
    "Sólidos": {
      "TEOR HPLC 1": [
        {
          "similaridade": "MESMO HPLC 1",
          "rota": "HPLC DAD",
          "atividade": "Tempo de corrida das Padrão Calibração",
          "padrao_amostra": "Padrão",
          "execucao": "MAQ",
          "tempo_corrida_minutos": 350
        }
      ]
    }
  }
}
```

**Arquivo: demanda_estruturada.json**
```json
[
  {
    "codigo_pa": 412440,
    "codigo_bulk": 107179,
    "descricao": "HEMOLENTA 5000ML BO CX (2)",
    "ativo": "HEMOLENTA",
    "forma_farmaceutica": "Sólidos",
    "celula": "SÓLIDOS 2 e 5",
    "media_12_meses": 12416.67,
    "fator_conversao": 2,
    "demanda_convertida": 24833.33,
    "tamanho_bulk": 611,
    "demanda_em_lotes": 48.77
  }
]
```

**Arquivo: indices_busca.json**
```json
{
  "ativos": ["ABIRATERONA", "ACETILCISTEINA", ...],
  "formas_farmaceuticas": ["Sólidos", "Líquidos", "Injetáveis", ...],
  "testes": ["TEOR HPLC 1", "DEGRADAÇÃO HPLC 1", ...],
  "rotas": ["HPLC DAD", "HPLC UV", "DISSOLUTOR", ...],
  "celulas": ["SÓLIDOS 1", "SÓLIDOS 2 e 5", ...],
  "produtos_por_ativo": {
    "HEMOLENTA": [
      {
        "codigo_pa": 412440,
        "descricao": "HEMOLENTA 5000ML BO CX (2)",
        "celula": "SÓLIDOS 2 e 5"
      }
    ]
  }
}
```

### 5.2 Algoritmo Principal

```pseudocode
FUNÇÃO analisar_produto(ativo, forma, media, fator, tamanho_bulk):
  
  1. Buscar fluxo do ativo na BASEFLUXO
     fluxo ← basefluxo[ativo][forma]
  
  2. Se fluxo não encontrado:
     - Buscar ativo similar
     - Se não houver similar, retornar erro
  
  3. Calcular demanda
     demanda_convertida ← media × fator
     demanda_lotes ← demanda_convertida / tamanho_bulk
  
  4. Calcular tempo total
     tempo_total ← SOMA(tempo de cada atividade em fluxo)
  
  5. Determinar célula
     celula ← mapear_forma_para_celula(forma)
  
  6. Calcular carga
     carga_total ← demanda_lotes × tempo_total
  
  7. Retornar resultado estruturado
     RETORNAR {
       ativo: ativo,
       forma: forma,
       celula: celula,
       demanda: {...},
       analises_cq: [...],
       resumo_tempos: {...}
     }
```

---

## 6. Integração com Sistemas

### 6.1 Integração Python

```python
import json

# Carregar dados
with open('basefluxo_estruturado.json') as f:
    basefluxo = json.load(f)

with open('demanda_estruturada.json') as f:
    demanda = json.load(f)

# Analisar produto
def analisar_produto(ativo, forma, media, fator, bulk):
    fluxo = basefluxo.get(ativo, {}).get(forma, {})
    
    demanda_convertida = media * fator
    demanda_lotes = demanda_convertida / bulk if bulk > 0 else 0
    
    tempo_total = sum(
        atividade['tempo_corrida_minutos']
        for teste in fluxo.values()
        for atividade in teste
    )
    
    return {
        'ativo': ativo,
        'forma': forma,
        'demanda_lotes': demanda_lotes,
        'tempo_total_minutos': tempo_total,
        'carga_total': demanda_lotes * tempo_total
    }

# Usar
resultado = analisar_produto('ABIRATERONA', 'Sólidos', 10000, 2, 500)
print(json.dumps(resultado, indent=2))
```

### 6.2 Integração JavaScript/Node.js

```javascript
const fs = require('fs');

// Carregar dados
const basefluxo = JSON.parse(fs.readFileSync('basefluxo_estruturado.json'));
const demanda = JSON.parse(fs.readFileSync('demanda_estruturada.json'));

// Analisar produto
function analisarProduto(ativo, forma, media, fator, bulk) {
  const fluxo = basefluxo[ativo]?.[forma] || {};
  
  const demandaConvertida = media * fator;
  const demandaLotes = bulk > 0 ? demandaConvertida / bulk : 0;
  
  let tempoTotal = 0;
  Object.values(fluxo).forEach(teste => {
    teste.forEach(atividade => {
      tempoTotal += atividade.tempo_corrida_minutos;
    });
  });
  
  return {
    ativo,
    forma,
    demandaLotes,
    tempoTotalMinutos: tempoTotal,
    cargaTotal: demandaLotes * tempoTotal
  };
}

// Usar
const resultado = analisarProduto('ABIRATERONA', 'Sólidos', 10000, 2, 500);
console.log(JSON.stringify(resultado, null, 2));
```

### 6.3 Integração SQL

```sql
-- Criar tabelas
CREATE TABLE ativos (
  id INT PRIMARY KEY,
  nome VARCHAR(255),
  forma_farmaceutica VARCHAR(100)
);

CREATE TABLE fluxos_cq (
  id INT PRIMARY KEY,
  ativo_id INT,
  teste VARCHAR(255),
  rota VARCHAR(255),
  tempo_minutos FLOAT,
  FOREIGN KEY (ativo_id) REFERENCES ativos(id)
);

CREATE TABLE produtos_demanda (
  id INT PRIMARY KEY,
  codigo_pa VARCHAR(50),
  ativo_id INT,
  media_12_meses FLOAT,
  fator_conversao FLOAT,
  tamanho_bulk FLOAT,
  celula VARCHAR(100),
  FOREIGN KEY (ativo_id) REFERENCES ativos(id)
);

-- Consulta: Calcular carga de um produto
SELECT 
  p.codigo_pa,
  a.nome as ativo,
  (p.media_12_meses * p.fator_conversao / p.tamanho_bulk) as demanda_lotes,
  SUM(f.tempo_minutos) as tempo_total_minutos,
  (p.media_12_meses * p.fator_conversao / p.tamanho_bulk) * SUM(f.tempo_minutos) as carga_total
FROM produtos_demanda p
JOIN ativos a ON p.ativo_id = a.id
JOIN fluxos_cq f ON a.id = f.ativo_id
GROUP BY p.id, p.codigo_pa, a.nome, p.media_12_meses, p.fator_conversao, p.tamanho_bulk;
```

### 6.4 Integração REST API

```python
from flask import Flask, jsonify, request
import json

app = Flask(__name__)

# Carregar dados
with open('basefluxo_estruturado.json') as f:
    basefluxo = json.load(f)

@app.route('/api/produto/analisar', methods=['POST'])
def analisar_produto():
    data = request.json
    
    ativo = data.get('ativo')
    forma = data.get('forma')
    media = data.get('media', 0)
    fator = data.get('fator', 1)
    bulk = data.get('bulk', 0)
    
    fluxo = basefluxo.get(ativo, {}).get(forma, {})
    
    demanda_convertida = media * fator
    demanda_lotes = demanda_convertida / bulk if bulk > 0 else 0
    
    tempo_total = sum(
        atividade['tempo_corrida_minutos']
        for teste in fluxo.values()
        for atividade in teste
    )
    
    return jsonify({
        'ativo': ativo,
        'forma': forma,
        'demanda_lotes': demanda_lotes,
        'tempo_total_minutos': tempo_total,
        'carga_total': demanda_lotes * tempo_total
    })

if __name__ == '__main__':
    app.run(debug=True)
```

---

## 7. Validações e Regras

### 7.1 Validações Obrigatórias

```python
def validar_entrada(ativo, forma, media, fator, bulk):
    erros = []
    
    # Validar ativo
    if not ativo or not isinstance(ativo, str):
        erros.append("Ativo deve ser uma string não vazia")
    
    # Validar forma
    formas_validas = ['Sólidos', 'Líquidos', 'Injetáveis', 'Suspensões', 'Cremes', 'Pomadas']
    if forma not in formas_validas:
        erros.append(f"Forma deve ser uma de: {', '.join(formas_validas)}")
    
    # Validar números
    if media < 0:
        erros.append("Média não pode ser negativa")
    if fator <= 0:
        erros.append("Fator deve ser positivo")
    if bulk <= 0:
        erros.append("Tamanho do bulk deve ser positivo")
    
    return erros
```

### 7.2 Alertas de Capacidade

```python
def verificar_capacidade(celula, carga_horas):
    capacidades = {
        'SÓLIDOS 1': 528,
        'SÓLIDOS 2 e 5': 528,
        'SÓLIDOS 3 e 4': 528,
        'SUSP/LIQ/CR/POM I, II e III': 528,
        'INJETÁVEIS e ONCOLÓGICOS': 528,
        'HORMONIOS': 528
    }
    
    capacidade = capacidades.get(celula, 0)
    ocupacao = (carga_horas / capacidade * 100) if capacidade > 0 else 0
    
    if ocupacao > 100:
        return {'status': 'ERRO', 'mensagem': 'Capacidade insuficiente', 'ocupacao': ocupacao}
    elif ocupacao > 80:
        return {'status': 'AVISO', 'mensagem': 'Capacidade próxima ao limite', 'ocupacao': ocupacao}
    else:
        return {'status': 'OK', 'mensagem': 'Capacidade disponível', 'ocupacao': ocupacao}
```

---

## 8. Exemplos de Uso

### Exemplo 1: Análise Simples

**Input**:
```json
{
  "ativo": "ABIRATERONA",
  "forma": "Sólidos",
  "media": 10000,
  "fator": 2,
  "bulk": 500
}
```

**Output**:
```json
{
  "ativo": "ABIRATERONA",
  "forma": "Sólidos",
  "demanda_lotes": 40,
  "tempo_total_minutos": 4080.64,
  "tempo_total_horas": 68.01,
  "carga_total_minutos": 163225.6,
  "carga_total_horas": 2720.43
}
```

### Exemplo 2: Análise com Detalhes

**Input**:
```json
{
  "ativo": "HEMOLENTA",
  "forma": "Sólidos",
  "media": 12416.67,
  "fator": 2,
  "bulk": 611,
  "detalhes": true
}
```

**Output**:
```json
{
  "ativo": "HEMOLENTA",
  "forma": "Sólidos",
  "celula": "SÓLIDOS 2 e 5",
  "demanda": {
    "media_12_meses": 12416.67,
    "fator_conversao": 2,
    "demanda_convertida": 24833.34,
    "tamanho_bulk": 611,
    "demanda_em_lotes": 40.63
  },
  "analises_cq": [
    {
      "teste": "TEOR HPLC 1",
      "rota": "HPLC DAD",
      "atividades": [
        {
          "descricao": "Tempo de corrida das Padrão Calibração",
          "execucao": "MAQ",
          "tempo_minutos": 350
        }
      ]
    }
  ],
  "resumo_tempos": {
    "tempo_unitario_minutos": 4080.64,
    "tempo_unitario_horas": 68.01,
    "tempo_total_lotes_minutos": 166025.63,
    "tempo_total_lotes_horas": 2767.09
  }
}
```

---

## 9. Troubleshooting

### Problema: Ativo não encontrado

**Causa**: O ativo não existe na base BASEFLUXO

**Solução**:
1. Verificar se o nome está correto (case-sensitive)
2. Buscar ativos similares usando índices
3. Se necessário, criar novo fluxo baseado em produto similar

### Problema: Forma farmacêutica não mapeada

**Causa**: A forma não está no mapeamento de células

**Solução**:
1. Verificar se a forma está na lista de formas válidas
2. Usar forma mais similar se disponível
3. Atualizar mapeamento se nova forma foi adicionada

### Problema: Cálculo de demanda incorreto

**Causa**: Valores de entrada fora do esperado

**Solução**:
1. Validar que fator > 0 e bulk > 0
2. Verificar unidades de medida
3. Confirmar se fator de conversão está correto

---

## 10. Extensões Futuras

1. **Integração com Banco de Dados**: Persistência de dados
2. **API REST Completa**: CRUD para produtos
3. **Relatórios em PDF**: Geração automática
4. **Gráficos de Capacidade**: Visualização de ocupação
5. **Alertas Automáticos**: Notificações de limite de capacidade
6. **Histórico de Demanda**: Tracking de mudanças
7. **Previsão de Demanda**: Machine Learning para projeções

---

## 11. Referências

- **Planilha Base**: BASEFLUXOTEMPOANALISE.xlsx
- **Planilha Demanda**: MFVCQ_Oficial-DEMANDAATUALIZADAFEVMARABR2024.xlsb
- **Dados Estruturados**: basefluxo_estruturado.json, demanda_estruturada.json, indices_busca.json
- **Script Principal**: analyze_product.py

---

**Versão**: 1.0  
**Data**: 19 de junho de 2026  
**Status**: ✅ Produção
