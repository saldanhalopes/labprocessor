# Guia de Integração de Skills em Projetos de IA

## Introdução

Este guia fornece instruções práticas para integrar as skills de análise de demanda e fluxo de CQ em seus projetos de IA, independentemente da plataforma ou linguagem que você use.

---

## 1. Estrutura de Arquivos da Skill

```
skill-mfvcq-demand-analyzer/
├── SKILL.md                          # Documentação principal
├── references/
│   ├── basefluxo_estruturado.json   # Base de fluxos de CQ
│   ├── demanda_estruturada.json     # Base de demanda
│   └── indices_busca.json           # Índices para busca
├── templates/
│   └── template_novo_produto.json   # Template de produto
└── scripts/
    └── analyze_product.py           # Script principal
```

---

## 2. Integração em Python

### 2.1 Instalação Básica

```bash
# Clonar ou copiar os arquivos
cp -r skill-mfvcq-demand-analyzer /seu/projeto/skills/

# Não há dependências externas além de json (built-in)
```

### 2.2 Uso Direto

```python
import json
import sys
from pathlib import Path

# Adicionar skill ao path
skill_path = Path(__file__).parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))

# Importar função
from analyze_product import load_data, analyze_product

# Usar
resultado = analyze_product(
    ativo='ABIRATERONA',
    forma='Sólidos',
    media_mensal=10000,
    fator_conversao=2,
    tamanho_bulk=500
)

print(json.dumps(resultado, indent=2, ensure_ascii=False))
```

### 2.3 Integração em Framework Django

```python
# seu_projeto/apps/qualidade/views.py

from django.http import JsonResponse
from django.views import View
import json
import sys
from pathlib import Path

# Carregar skill
skill_path = Path(__file__).parent.parent.parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))
from analyze_product import analyze_product

class AnalisarProdutoView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            
            resultado = analyze_product(
                ativo=data.get('ativo'),
                codigo_pa=data.get('codigo_pa'),
                forma=data.get('forma'),
                media_mensal=float(data.get('media', 0)),
                fator_conversao=float(data.get('fator', 1)),
                tamanho_bulk=float(data.get('bulk', 0))
            )
            
            return JsonResponse(resultado)
        except Exception as e:
            return JsonResponse({'erro': str(e)}, status=400)

# urls.py
from django.urls import path
from .views import AnalisarProdutoView

urlpatterns = [
    path('api/produto/analisar/', AnalisarProdutoView.as_view(), name='analisar_produto'),
]
```

### 2.4 Integração em Flask

```python
# app.py

from flask import Flask, request, jsonify
import json
import sys
from pathlib import Path

app = Flask(__name__)

# Carregar skill
skill_path = Path(__file__).parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))
from analyze_product import analyze_product

@app.route('/api/produto/analisar', methods=['POST'])
def analisar_produto():
    try:
        data = request.get_json()
        
        resultado = analyze_product(
            ativo=data.get('ativo'),
            codigo_pa=data.get('codigo_pa'),
            forma=data.get('forma'),
            media_mensal=float(data.get('media', 0)),
            fator_conversao=float(data.get('fator', 1)),
            tamanho_bulk=float(data.get('bulk', 0))
        )
        
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'erro': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
```

### 2.5 Integração em FastAPI

```python
# main.py

from fastapi import FastAPI
from pydantic import BaseModel
import json
import sys
from pathlib import Path

app = FastAPI()

# Carregar skill
skill_path = Path(__file__).parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))
from analyze_product import analyze_product

class ProdutoRequest(BaseModel):
    ativo: str
    forma: str
    media: float = 0
    fator: float = 1
    bulk: float = 0
    codigo_pa: str = None

@app.post("/api/produto/analisar")
async def analisar_produto(produto: ProdutoRequest):
    try:
        resultado = analyze_product(
            ativo=produto.ativo,
            codigo_pa=produto.codigo_pa,
            forma=produto.forma,
            media_mensal=produto.media,
            fator_conversao=produto.fator,
            tamanho_bulk=produto.bulk
        )
        return resultado
    except Exception as e:
        return {"erro": str(e)}, 400
```

### 2.6 Integração em Celery (Tarefas Assíncronas)

```python
# tasks.py

from celery import Celery
import json
import sys
from pathlib import Path

app = Celery('qualidade')

# Carregar skill
skill_path = Path(__file__).parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))
from analyze_product import analyze_product

@app.task
def analisar_produto_async(ativo, forma, media, fator, bulk):
    """Tarefa assíncrona para análise de produto"""
    resultado = analyze_product(
        ativo=ativo,
        forma=forma,
        media_mensal=media,
        fator_conversao=fator,
        tamanho_bulk=bulk
    )
    
    # Salvar resultado em banco de dados
    # salvar_resultado_bd(resultado)
    
    return resultado

# Usar
from tasks import analisar_produto_async

task = analisar_produto_async.delay(
    ativo='ABIRATERONA',
    forma='Sólidos',
    media=10000,
    fator=2,
    bulk=500
)

resultado = task.get()
```

---

## 3. Integração em JavaScript/Node.js

### 3.1 Uso Básico

```javascript
// analyze_product.js

const fs = require('fs');
const path = require('path');

class MFVCQAnalyzer {
  constructor(skillPath) {
    this.skillPath = skillPath;
    this.basefluxo = JSON.parse(
      fs.readFileSync(path.join(skillPath, 'references', 'basefluxo_estruturado.json'))
    );
    this.demanda = JSON.parse(
      fs.readFileSync(path.join(skillPath, 'references', 'demanda_estruturada.json'))
    );
    this.indices = JSON.parse(
      fs.readFileSync(path.join(skillPath, 'references', 'indices_busca.json'))
    );
  }

  analisarProduto(ativo, forma, media, fator, bulk) {
    const ativoUpper = ativo.toUpperCase();
    const fluxoAtivo = this.basefluxo[ativoUpper] || {};
    const fluxoForma = fluxoAtivo[forma] || {};

    // Calcular demanda
    const demandaConvertida = media * fator;
    const demandaLotes = bulk > 0 ? demandaConvertida / bulk : 0;

    // Calcular tempo total
    let tempoTotal = 0;
    Object.values(fluxoForma).forEach(teste => {
      teste.forEach(atividade => {
        tempoTotal += atividade.tempo_corrida_minutos || 0;
      });
    });

    // Determinar célula
    let celula = 'DESCONHECIDA';
    if (forma.toLowerCase().includes('sólido')) {
      celula = 'SÓLIDOS 1';
    } else if (forma.toLowerCase().includes('líquido')) {
      celula = 'SUSP/LIQ/CR/POM I, II e III';
    }

    return {
      ativo: ativoUpper,
      forma,
      celula,
      demanda: {
        media_12_meses: media,
        fator_conversao: fator,
        demanda_convertida: demandaConvertida,
        tamanho_bulk: bulk,
        demanda_em_lotes: demandaLotes
      },
      resumo_tempos: {
        tempo_unitario_minutos: tempoTotal,
        tempo_unitario_horas: (tempoTotal / 60).toFixed(2),
        tempo_total_lotes_minutos: tempoTotal * demandaLotes,
        tempo_total_lotes_horas: ((tempoTotal * demandaLotes) / 60).toFixed(2)
      }
    };
  }
}

module.exports = MFVCQAnalyzer;
```

### 3.2 Integração em Express.js

```javascript
// app.js

const express = require('express');
const MFVCQAnalyzer = require('./analyze_product');
const path = require('path');

const app = express();
app.use(express.json());

// Inicializar analyzer
const skillPath = path.join(__dirname, 'skills', 'mfvcq-demand-analyzer');
const analyzer = new MFVCQAnalyzer(skillPath);

// Rota de análise
app.post('/api/produto/analisar', (req, res) => {
  try {
    const { ativo, forma, media, fator, bulk } = req.body;

    const resultado = analyzer.analisarProduto(
      ativo,
      forma,
      parseFloat(media) || 0,
      parseFloat(fator) || 1,
      parseFloat(bulk) || 0
    );

    res.json(resultado);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
```

### 3.3 Integração em Next.js

```javascript
// pages/api/produto/analisar.js

import MFVCQAnalyzer from '../../../lib/mfvcq-analyzer';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const skillPath = path.join(process.cwd(), 'public', 'skills', 'mfvcq-demand-analyzer');
    const analyzer = new MFVCQAnalyzer(skillPath);

    const { ativo, forma, media, fator, bulk } = req.body;

    const resultado = analyzer.analisarProduto(
      ativo,
      forma,
      parseFloat(media) || 0,
      parseFloat(fator) || 1,
      parseFloat(bulk) || 0
    );

    res.status(200).json(resultado);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
}
```

---

## 4. Integração em Java/Spring Boot

### 4.1 Classe de Serviço

```java
// MFVCQAnalyzerService.java

package com.seu.projeto.qualidade.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.io.File;
import java.util.*;

@Service
public class MFVCQAnalyzerService {
    
    private Map<String, Object> basefluxo;
    private List<Map<String, Object>> demanda;
    private ObjectMapper objectMapper = new ObjectMapper();
    
    public MFVCQAnalyzerService() {
        carregarDados();
    }
    
    private void carregarDados() {
        try {
            String skillPath = "skills/mfvcq-demand-analyzer/references/";
            
            basefluxo = objectMapper.readValue(
                new File(skillPath + "basefluxo_estruturado.json"),
                Map.class
            );
            
            demanda = objectMapper.readValue(
                new File(skillPath + "demanda_estruturada.json"),
                List.class
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    public Map<String, Object> analisarProduto(
            String ativo, String forma, double media, 
            double fator, double bulk) {
        
        Map<String, Object> resultado = new HashMap<>();
        
        // Buscar fluxo
        Map<String, Object> fluxoAtivo = (Map<String, Object>) basefluxo.get(ativo.toUpperCase());
        Map<String, Object> fluxoForma = fluxoAtivo != null ? 
            (Map<String, Object>) fluxoAtivo.get(forma) : new HashMap<>();
        
        // Calcular demanda
        double demandaConvertida = media * fator;
        double demandaLotes = bulk > 0 ? demandaConvertida / bulk : 0;
        
        // Calcular tempo
        double tempoTotal = calcularTempoTotal(fluxoForma);
        
        // Montar resultado
        resultado.put("ativo", ativo.toUpperCase());
        resultado.put("forma", forma);
        resultado.put("demanda_lotes", demandaLotes);
        resultado.put("tempo_total_minutos", tempoTotal);
        resultado.put("tempo_total_horas", tempoTotal / 60);
        resultado.put("carga_total", demandaLotes * tempoTotal);
        
        return resultado;
    }
    
    private double calcularTempoTotal(Map<String, Object> fluxoForma) {
        double tempo = 0;
        for (Object teste : fluxoForma.values()) {
            if (teste instanceof List) {
                for (Object atividade : (List<?>) teste) {
                    if (atividade instanceof Map) {
                        Object tempoObj = ((Map<?, ?>) atividade).get("tempo_corrida_minutos");
                        if (tempoObj instanceof Number) {
                            tempo += ((Number) tempoObj).doubleValue();
                        }
                    }
                }
            }
        }
        return tempo;
    }
}
```

### 4.2 Controller REST

```java
// ProdutoController.java

package com.seu.projeto.qualidade.controller;

import com.seu.projeto.qualidade.service.MFVCQAnalyzerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/produto")
public class ProdutoController {
    
    @Autowired
    private MFVCQAnalyzerService analyzerService;
    
    @PostMapping("/analisar")
    public Map<String, Object> analisarProduto(@RequestBody Map<String, Object> request) {
        String ativo = (String) request.get("ativo");
        String forma = (String) request.get("forma");
        double media = ((Number) request.get("media")).doubleValue();
        double fator = ((Number) request.getOrDefault("fator", 1)).doubleValue();
        double bulk = ((Number) request.getOrDefault("bulk", 0)).doubleValue();
        
        return analyzerService.analisarProduto(ativo, forma, media, fator, bulk);
    }
}
```

---

## 5. Integração em C# / .NET

### 5.1 Classe de Serviço

```csharp
// MFVCQAnalyzerService.cs

using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class MFVCQAnalyzerService
{
    private JObject basefluxo;
    private JArray demanda;
    
    public MFVCQAnalyzerService(string skillPath)
    {
        CarregarDados(skillPath);
    }
    
    private void CarregarDados(string skillPath)
    {
        string basefluxoPath = Path.Combine(skillPath, "references", "basefluxo_estruturado.json");
        string demandaPath = Path.Combine(skillPath, "references", "demanda_estruturada.json");
        
        basefluxo = JObject.Parse(File.ReadAllText(basefluxoPath));
        demanda = JArray.Parse(File.ReadAllText(demandaPath));
    }
    
    public Dictionary<string, object> AnalisarProduto(
        string ativo, string forma, double media, 
        double fator, double bulk)
    {
        var resultado = new Dictionary<string, object>();
        
        // Buscar fluxo
        var fluxoAtivo = basefluxo[ativo.ToUpper()];
        var fluxoForma = fluxoAtivo?[forma] ?? new JObject();
        
        // Calcular demanda
        double demandaConvertida = media * fator;
        double demandaLotes = bulk > 0 ? demandaConvertida / bulk : 0;
        
        // Calcular tempo
        double tempoTotal = CalcularTempoTotal(fluxoForma);
        
        // Montar resultado
        resultado["ativo"] = ativo.ToUpper();
        resultado["forma"] = forma;
        resultado["demanda_lotes"] = demandaLotes;
        resultado["tempo_total_minutos"] = tempoTotal;
        resultado["tempo_total_horas"] = Math.Round(tempoTotal / 60, 2);
        resultado["carga_total"] = demandaLotes * tempoTotal;
        
        return resultado;
    }
    
    private double CalcularTempoTotal(JToken fluxoForma)
    {
        double tempo = 0;
        
        foreach (var teste in fluxoForma.Values())
        {
            if (teste is JArray atividades)
            {
                foreach (var atividade in atividades)
                {
                    var tempoObj = atividade["tempo_corrida_minutos"];
                    if (tempoObj != null && double.TryParse(tempoObj.ToString(), out double tempoValue))
                    {
                        tempo += tempoValue;
                    }
                }
            }
        }
        
        return tempo;
    }
}
```

### 5.2 Controller ASP.NET Core

```csharp
// ProdutoController.cs

using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

[ApiController]
[Route("api/[controller]")]
public class ProdutoController : ControllerBase
{
    private readonly MFVCQAnalyzerService _analyzerService;
    
    public ProdutoController()
    {
        _analyzerService = new MFVCQAnalyzerService("skills/mfvcq-demand-analyzer");
    }
    
    [HttpPost("analisar")]
    public ActionResult<Dictionary<string, object>> AnalisarProduto(
        [FromBody] ProdutoRequest request)
    {
        var resultado = _analyzerService.AnalisarProduto(
            request.Ativo,
            request.Forma,
            request.Media,
            request.Fator,
            request.Bulk
        );
        
        return Ok(resultado);
    }
}

public class ProdutoRequest
{
    public string Ativo { get; set; }
    public string Forma { get; set; }
    public double Media { get; set; }
    public double Fator { get; set; } = 1;
    public double Bulk { get; set; }
}
```

---

## 6. Integração em Go

### 6.1 Estrutura de Dados

```go
// analyzer.go

package mfvcq

import (
    "encoding/json"
    "io/ioutil"
)

type Atividade struct {
    Similaridade          string  `json:"similaridade"`
    Rota                  string  `json:"rota"`
    Atividade             string  `json:"atividade"`
    PadraoAmostra         string  `json:"padrao_amostra"`
    Execucao              string  `json:"execucao"`
    TempoCorridaMinutos   float64 `json:"tempo_corrida_minutos"`
}

type Analyzer struct {
    Basefluxo map[string]interface{}
    Demanda   []interface{}
}

func NewAnalyzer(skillPath string) (*Analyzer, error) {
    analyzer := &Analyzer{}
    
    // Carregar basefluxo
    basefluxoData, err := ioutil.ReadFile(skillPath + "/references/basefluxo_estruturado.json")
    if err != nil {
        return nil, err
    }
    json.Unmarshal(basefluxoData, &analyzer.Basefluxo)
    
    // Carregar demanda
    demandaData, err := ioutil.ReadFile(skillPath + "/references/demanda_estruturada.json")
    if err != nil {
        return nil, err
    }
    json.Unmarshal(demandaData, &analyzer.Demanda)
    
    return analyzer, nil
}

func (a *Analyzer) AnalisarProduto(ativo, forma string, media, fator, bulk float64) map[string]interface{} {
    resultado := make(map[string]interface{})
    
    // Calcular demanda
    demandaConvertida := media * fator
    demandaLotes := 0.0
    if bulk > 0 {
        demandaLotes = demandaConvertida / bulk
    }
    
    resultado["ativo"] = ativo
    resultado["forma"] = forma
    resultado["demanda_lotes"] = demandaLotes
    resultado["tempo_total_minutos"] = 0
    resultado["tempo_total_horas"] = 0
    
    return resultado
}
```

### 6.2 Handler HTTP

```go
// handler.go

package main

import (
    "encoding/json"
    "net/http"
    "mfvcq"
)

type ProdutoRequest struct {
    Ativo string  `json:"ativo"`
    Forma string  `json:"forma"`
    Media float64 `json:"media"`
    Fator float64 `json:"fator"`
    Bulk  float64 `json:"bulk"`
}

var analyzer *mfvcq.Analyzer

func init() {
    var err error
    analyzer, err = mfvcq.NewAnalyzer("skills/mfvcq-demand-analyzer")
    if err != nil {
        panic(err)
    }
}

func analisarProdutoHandler(w http.ResponseWriter, r *http.Request) {
    var req ProdutoRequest
    json.NewDecoder(r.Body).Decode(&req)
    
    resultado := analyzer.AnalisarProduto(req.Ativo, req.Forma, req.Media, req.Fator, req.Bulk)
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(resultado)
}

func main() {
    http.HandleFunc("/api/produto/analisar", analisarProdutoHandler)
    http.ListenAndServe(":8080", nil)
}
```

---

## 7. Integração em Banco de Dados

### 7.1 PostgreSQL

```sql
-- Criar schema
CREATE SCHEMA qualidade;

-- Tabela de ativos
CREATE TABLE qualidade.ativos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL UNIQUE,
    forma_farmaceutica VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de fluxos CQ
CREATE TABLE qualidade.fluxos_cq (
    id SERIAL PRIMARY KEY,
    ativo_id INTEGER REFERENCES qualidade.ativos(id),
    teste VARCHAR(255),
    rota VARCHAR(255),
    tempo_minutos FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de produtos com demanda
CREATE TABLE qualidade.produtos (
    id SERIAL PRIMARY KEY,
    codigo_pa VARCHAR(50) UNIQUE,
    codigo_bulk VARCHAR(50),
    descricao VARCHAR(500),
    ativo_id INTEGER REFERENCES qualidade.ativos(id),
    celula VARCHAR(100),
    media_12_meses FLOAT,
    fator_conversao FLOAT,
    tamanho_bulk FLOAT,
    demanda_em_lotes FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_ativo_id ON qualidade.fluxos_cq(ativo_id);
CREATE INDEX idx_produto_ativo ON qualidade.produtos(ativo_id);
CREATE INDEX idx_produto_celula ON qualidade.produtos(celula);

-- View: Cálculo de carga por célula
CREATE VIEW qualidade.carga_por_celula AS
SELECT 
    p.celula,
    COUNT(p.id) as quantidade_produtos,
    SUM(p.demanda_em_lotes * f.tempo_minutos) as carga_total_minutos,
    ROUND(SUM(p.demanda_em_lotes * f.tempo_minutos) / 60.0, 2) as carga_total_horas
FROM qualidade.produtos p
JOIN qualidade.ativos a ON p.ativo_id = a.id
JOIN qualidade.fluxos_cq f ON a.id = f.ativo_id
GROUP BY p.celula;
```

### 7.2 MongoDB

```javascript
// Criar collections
db.createCollection("ativos");
db.createCollection("fluxos_cq");
db.createCollection("produtos");

// Índices
db.ativos.createIndex({ "nome": 1 });
db.fluxos_cq.createIndex({ "ativo_id": 1 });
db.produtos.createIndex({ "ativo_id": 1 });
db.produtos.createIndex({ "celula": 1 });

// Documento de exemplo
db.ativos.insertOne({
  _id: ObjectId(),
  nome: "ABIRATERONA",
  forma_farmaceutica: "Sólidos",
  created_at: new Date()
});

db.fluxos_cq.insertOne({
  _id: ObjectId(),
  ativo_id: ObjectId("..."),
  teste: "TEOR HPLC 1",
  rota: "HPLC DAD",
  tempo_minutos: 350,
  created_at: new Date()
});

// Agregação: Carga por célula
db.produtos.aggregate([
  {
    $group: {
      _id: "$celula",
      quantidade_produtos: { $sum: 1 },
      carga_total_minutos: {
        $sum: {
          $multiply: ["$demanda_em_lotes", "$tempo_minutos"]
        }
      }
    }
  },
  {
    $project: {
      celula: "$_id",
      quantidade_produtos: 1,
      carga_total_minutos: 1,
      carga_total_horas: { $divide: ["$carga_total_minutos", 60] }
    }
  }
]);
```

---

## 8. Integração com APIs Externas

### 8.1 Slack Bot

```python
# slack_bot.py

from slack_bolt import App
from slack_bolt.adapter.flask import SlackRequestHandler
from flask import Flask
import json
import sys
from pathlib import Path

app_flask = Flask(__name__)
app = App()

# Carregar skill
skill_path = Path(__file__).parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))
from analyze_product import analyze_product

@app.command("/analisar-produto")
def handle_analisar_comando(ack, body, say):
    ack()
    
    try:
        # Parsear comando: /analisar-produto ABIRATERONA Sólidos 10000 2 500
        texto = body.get("text", "").split()
        
        if len(texto) < 5:
            say("Uso: /analisar-produto ATIVO FORMA MEDIA FATOR BULK")
            return
        
        resultado = analyze_product(
            ativo=texto[0],
            forma=texto[1],
            media_mensal=float(texto[2]),
            fator_conversao=float(texto[3]),
            tamanho_bulk=float(texto[4])
        )
        
        # Formatar resposta
        msg = f"""
*Análise de Produto*
Ativo: {resultado['ativo']}
Forma: {resultado['forma']}
Célula: {resultado['celula']}
Demanda em Lotes: {resultado['demanda']['demanda_em_lotes']:.2f}
Tempo Total: {resultado['resumo_tempos']['tempo_unitario_horas']} horas
Carga Total: {resultado['resumo_tempos']['tempo_total_lotes_horas']} horas
        """
        say(msg)
    except Exception as e:
        say(f"Erro: {str(e)}")

@app_flask.route("/slack/events", methods=["POST"])
def slack_events():
    handler = SlackRequestHandler(app)
    return handler.handle(request)

if __name__ == "__main__":
    app_flask.run(port=3000)
```

### 8.2 Google Sheets Integration

```python
# sheets_integration.py

from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request
import gspread
import json
import sys
from pathlib import Path

# Carregar skill
skill_path = Path(__file__).parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))
from analyze_product import analyze_product

# Autenticar com Google Sheets
creds = Credentials.from_service_account_file('credentials.json')
client = gspread.authorize(creds)

# Abrir planilha
sheet = client.open("Análise de Demanda").sheet1

# Ler dados
dados = sheet.get_all_records()

# Processar cada linha
for row in dados:
    resultado = analyze_product(
        ativo=row['Ativo'],
        forma=row['Forma'],
        media_mensal=float(row['Demanda Média']),
        fator_conversao=float(row['Fator']),
        tamanho_bulk=float(row['Tamanho Bulk'])
    )
    
    # Atualizar planilha com resultado
    sheet.append_row([
        row['Ativo'],
        resultado['demanda']['demanda_em_lotes'],
        resultado['resumo_tempos']['tempo_unitario_horas'],
        resultado['resumo_tempos']['tempo_total_lotes_horas']
    ])
```

---

## 9. Deployment

### 9.1 Docker

```dockerfile
# Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Copiar skill
COPY skills/mfvcq-demand-analyzer /app/skills/mfvcq-demand-analyzer

# Copiar aplicação
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Expor porta
EXPOSE 5000

# Comando de inicialização
CMD ["python", "app.py"]
```

### 9.2 Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
    volumes:
      - ./skills:/app/skills

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=qualidade
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=senha
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 9.3 Kubernetes

```yaml
# deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: mfvcq-analyzer
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mfvcq-analyzer
  template:
    metadata:
      labels:
        app: mfvcq-analyzer
    spec:
      containers:
      - name: mfvcq-analyzer
        image: seu-registry/mfvcq-analyzer:latest
        ports:
        - containerPort: 5000
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        volumeMounts:
        - name: skills
          mountPath: /app/skills
      volumes:
      - name: skills
        configMap:
          name: mfvcq-skills
```

---

## 10. Testes

### 10.1 Testes Unitários (Python)

```python
# test_analyzer.py

import unittest
import json
import sys
from pathlib import Path

skill_path = Path(__file__).parent / 'skills' / 'mfvcq-demand-analyzer'
sys.path.insert(0, str(skill_path / 'scripts'))
from analyze_product import analyze_product

class TestMFVCQAnalyzer(unittest.TestCase):
    
    def test_analise_abiraterona(self):
        resultado = analyze_product(
            ativo='ABIRATERONA',
            forma='Sólidos',
            media_mensal=10000,
            fator_conversao=2,
            tamanho_bulk=500
        )
        
        self.assertEqual(resultado['ativo'], 'ABIRATERONA')
        self.assertEqual(resultado['forma'], 'Sólidos')
        self.assertEqual(resultado['demanda']['demanda_em_lotes'], 40)
        self.assertGreater(resultado['resumo_tempos']['tempo_unitario_minutos'], 0)
    
    def test_demanda_zero(self):
        resultado = analyze_product(
            ativo='ABIRATERONA',
            forma='Sólidos',
            media_mensal=0,
            fator_conversao=1,
            tamanho_bulk=500
        )
        
        self.assertEqual(resultado['demanda']['demanda_em_lotes'], 0)
    
    def test_bulk_invalido(self):
        resultado = analyze_product(
            ativo='ABIRATERONA',
            forma='Sólidos',
            media_mensal=10000,
            fator_conversao=2,
            tamanho_bulk=0
        )
        
        self.assertEqual(resultado['demanda']['demanda_em_lotes'], 0)

if __name__ == '__main__':
    unittest.main()
```

### 10.2 Testes de Integração

```python
# test_integration.py

import requests
import json

BASE_URL = "http://localhost:5000"

def test_api_analisar_produto():
    payload = {
        "ativo": "ABIRATERONA",
        "forma": "Sólidos",
        "media": 10000,
        "fator": 2,
        "bulk": 500
    }
    
    response = requests.post(f"{BASE_URL}/api/produto/analisar", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data['ativo'] == 'ABIRATERONA'
    assert data['demanda']['demanda_em_lotes'] == 40

if __name__ == '__main__':
    test_api_analisar_produto()
    print("✅ Teste de integração passou!")
```

---

## 11. Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| Arquivo JSON não encontrado | Caminho incorreto | Verificar path relativo/absoluto |
| Ativo não encontrado | Ativo não existe na base | Usar índices para buscar ativos válidos |
| Erro de divisão por zero | Tamanho bulk = 0 | Validar entrada antes de chamar função |
| Memória insuficiente | Arquivos JSON muito grandes | Usar paginação ou índices |
| Lentidão | Muitas requisições | Implementar cache ou fila |

---

## 12. Checklist de Integração

- [ ] Copiar arquivos da skill para o projeto
- [ ] Carregar dados JSON (basefluxo, demanda, índices)
- [ ] Implementar função de análise
- [ ] Criar endpoints/rotas da API
- [ ] Adicionar validações de entrada
- [ ] Implementar tratamento de erros
- [ ] Criar testes unitários
- [ ] Criar testes de integração
- [ ] Documentar API
- [ ] Fazer deploy em staging
- [ ] Fazer deploy em produção
- [ ] Monitorar performance
- [ ] Coletar feedback dos usuários

---

**Versão**: 1.0  
**Data**: 19 de junho de 2026  
**Status**: ✅ Pronto para Uso
