import { queryVectors } from './pgvector.js';
import { callOpenRouterAgent } from './gemini.js';
import { analyzeProduct, searchProducts, getBasfluxoForTests } from './mfvcq.js';
import { getStats, getJournal } from './learning.js';
import { findSimilar } from './knowledge.js';
import { remember, recall } from './mem0-client.js';

const CHAT_SYSTEM_PROMPT = `Você é o "LabProcessor Chat", assistente especializado em Controle de Qualidade Farmacêutico.

Use as FERRAMENTAS disponíveis para consultar dados reais. NUNCA invente números ou nomes de produtos.
Se uma ferramenta retornar "não encontrado", informe o usuário educadamente.
Formate respostas com markdown (tabelas, negrito, listas).
Seja direto e profissional.

Ferramentas disponíveis:
- search_products: busca produtos por nome/ativo/código (inclui códigos externos ANVISA) na matriz MFVCQ
- analyze_product: análise completa (célula, demanda, tempos, testes CQ). Aceita código externo.
- get_basfluxo_for_tests: mapeia testes para BASEFLUXO com tempos calibrados
- query_knowledge: busca testes no knowledge vault (aliases, técnicas, rotas)
- get_learning_stats: estatísticas do journal (match rate, bias, stubs)
- list_recent_extractions: últimas extrações processadas
  - search_documents: busca semântica em documentos indexados (RAG)
  - remember: armazena uma informação importante para recuperação futura
  - recall: recupera memórias passadas sobre um tópico`;

const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Busca produtos na matriz MFVCQ por nome, principio ativo ou código (PA interno e código externo ANVISA). Retorna lista com código, descrição, célula e demanda.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca (nome do produto, ativo ou código)' },
          limit: { type: 'number', description: 'Máximo de resultados (default 5)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_product',
      description: 'Análise MFVCQ completa de um produto: célula de produção, demanda mensal, demanda em lotes, testes CQ aplicáveis com tempos fixo/variável. Pode buscar por ativo ou código externo.',
      parameters: {
        type: 'object',
        properties: {
          ativo: { type: 'string', description: 'Nome do principio ativo (ex: HEMOLENTA, CLOZAPINA)' },
          forma: { type: 'string', description: 'Forma farmacêutica (ex: Comprimidos, Sólidos). Opcional.' },
          codigoPa: { type: 'string', description: 'Código PA interno do produto' },
          externalCode: { type: 'string', description: 'Código externo/ANVISA do produto (ex: 30.0465-PE)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_basfluxo_for_tests',
      description: 'Mapeia nomes de testes do Gemini para o BASEFLUXO padronizado. Retorna tempos calibrados (fixo + variável por lote) com learned_scale.',
      parameters: {
        type: 'object',
        properties: {
          ativo: { type: 'string', description: 'Nome do principio ativo' },
          forma: { type: 'string', description: 'Forma farmacêutica (ex: Comprimidos)' },
          testes: { type: 'array', items: { type: 'string' }, description: 'Lista de nomes de testes para mapear' }
        },
        required: ['ativo', 'testes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'query_knowledge',
      description: 'Busca um teste no knowledge vault. Retorna nome padronizado, aliases, técnica, rotas e learned_scale. Retorna null se desconhecido.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do teste para buscar (ex: HPLC, Dureza, Dissolução)' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_learning_stats',
      description: 'Estatísticas do sistema de aprendizado: total de extrações, match rate, top testes, top técnicas, viés global.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_recent_extractions',
      description: 'Lista as extrações mais recentes processadas pelo sistema.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número de extrações (default 5)' },
          days: { type: 'number', description: 'Dias para trás (default 30)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_documents',
      description: 'Busca semântica (RAG) nos documentos PDF já processados. Encontra trechos similares à consulta.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto da consulta para busca semântica' },
          topK: { type: 'number', description: 'Número de resultados (default 3)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Armazena uma informação importante na memória persistente para recuperação futura. Use para guardar decisões, preferências e contexto de conversa.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Conteúdo a ser lembrado' }
        },
        required: ['content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'recall',
      description: 'Recupera informações armazenadas na memória sobre um tópico específico.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Termo de busca para recuperar memórias relevantes' }
        },
        required: ['query']
      }
    }
  }
];

async function executeChatTools(toolCalls) {
  const results = await Promise.all(toolCalls.map(async (tc) => {
    const { name, arguments: args } = tc.function;
    let parsed = {};
    try { parsed = JSON.parse(args); } catch (e) { parsed = {}; }

    try {
      switch (name) {
        case 'search_products': {
          const r = searchProducts({ query: parsed.query, limit: parsed.limit || 5 });
          return {
            tool_call_id: tc.id, name,
            output: r.map(p => ({
              codigo: p.codigo_pa,
              descricao: p.descricao,
              ativo: p.ativo,
              celula: p.celula,
              demanda_media: p.media_12_meses,
              fator: p.fator_conversao
            })).slice(0, parsed.limit || 5)
          };
        }

        case 'analyze_product': {
          const r = analyzeProduct({ ativo: parsed.ativo, forma: parsed.forma, codigoPa: parsed.codigoPa, externalCode: parsed.externalCode });
          return {
            tool_call_id: tc.id, name,
            output: r ? {
              ativo: r.ativo,
              celula: r.celula,
              forma: r.forma_farmaceutica,
              demanda_media: r.demanda?.media_12_meses,
              demanda_lotes: r.demanda?.demanda_em_lotes,
              fator_conversao: r.demanda?.fator_conversao,
              total_lotes: r.demanda?.total_lotes,
              testes_cq: (r.analises_cq || []).map(a => ({
                teste: a.teste,
                rota: a.rota,
                fixo_min: a.fixo?.total_min,
                var_min: a.variavel?.total_min,
                compartilhado_min: a.total_compartilhado_min
              })),
              resumo_horas: {
                unitario: r.resumo_tempos?.tempo_unitario_horas,
                compartilhado: r.resumo_tempos?.tempo_compartilhado_horas,
                carga_homem: r.resumo_tempos?.carga_homem_mensal_h
              }
            } : null
          };
        }

        case 'get_basfluxo_for_tests': {
          const geminiRows = (parsed.testes || []).map(t => ({
            testName: t, technique: '', t_prep: 0, t_analysis: 0, t_run: 0, t_calc: 0, t_incubation: 0
          }));
          const bf = getBasfluxoForTests({
            ativo: parsed.ativo,
            forma: parsed.forma || 'Sólidos',
            geminiRows
          });
          return {
            tool_call_id: tc.id, name,
            output: {
              celula: bf.celula,
              lotes: bf.quantidade_lotes,
              origem_lotes: bf.demanda_lotes_origem,
              testes: (bf.testes || []).filter(t => !t.stub).map(t => ({
                teste: t.teste,
                gemini_match: t.geminiMatch,
                score: t.score,
                fixo_min: t.fixo?.total_min,
                var_min: t.variavel?.total_min,
                total_calibrado_min: t.total_compartilhado_min,
                learned_scale: t.learned_scale
              })),
              stubs: (bf.testes || []).filter(t => t.stub).length,
              resumo_h: {
                compartilhado: bf.resumo_tempos?.tempo_compartilhado_horas,
                fixo: bf.resumo_tempos?.fixo_horas
              }
            }
          };
        }

        case 'query_knowledge': {
          const match = findSimilar(parsed.name);
          return {
            tool_call_id: tc.id, name,
            output: match ? {
              teste: match.teste,
              score: match.score,
              source: match.source
            } : null
          };
        }

        case 'get_learning_stats': {
          const stats = getStats();
          return {
            tool_call_id: tc.id, name,
            output: {
              total_extracoes: stats.totalExtractions,
              total_testes_extraidos: stats.totalExtractedTests,
              match_rate: stats.matchRate,
              total_stubs: stats.totalStubsCreated,
              total_aliases: stats.totalAliasesAdded,
              top_testes: stats.topTests?.slice(0, 5),
              top_tecnicas: stats.topTechniques
            }
          };
        }

        case 'list_recent_extractions': {
          const journal = getJournal({ days: parsed.days || 30, limit: parsed.limit || 5 });
          return {
            tool_call_id: tc.id, name,
            output: journal.entries.map(e => ({
              arquivo: e.fileName,
              produto: e.productName,
              data: e.timestamp?.slice(0, 10),
              testes_extraidos: e.extractedTests,
              matched: e.matchedTests,
              stubs: e.stubsCreated
            }))
          };
        }

        case 'search_documents': {
          const matches = await queryVectors(parsed.query, parsed.topK || 3);
          return {
            tool_call_id: tc.id, name,
            output: matches.map(m => ({
              produto: m.metadata?.productName,
              teste: m.metadata?.testName,
              tecnica: m.metadata?.technique,
              score: m.score
            }))
          };
        }

        case 'remember': {
          const memories = await remember(parsed.content);
          return { tool_call_id: tc.id, name, output: { stored: memories.length, memories } };
        }

        case 'recall': {
          const results = await recall(parsed.query);
          return { tool_call_id: tc.id, name, output: results.map(r => r.memory) };
        }

        default:
          return { tool_call_id: tc.id, name, error: 'Unknown tool' };
      }
    } catch (err) {
      return { tool_call_id: tc.id, name, error: err.message };
    }
  }));

  return results;
}

export async function handleChatMessage(req, res) {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log(`[Chat] Processing: "${message.substring(0, 80)}..."`);

    let enrichedPrompt = CHAT_SYSTEM_PROMPT;
    try {
      const mem0Context = await recall(message);
      if (mem0Context.length > 0) {
        const contextStr = mem0Context.slice(0, 3).map(m => `- ${m.memory}`).join('\n');
        enrichedPrompt += `\n\n## Memórias de Conversas Anteriores Relevantes\n${contextStr}\nUse estas memórias como contexto adicional quando pertinente.`;
      }
    } catch (e) { /* mem0 best-effort */ }

    const { content, trace } = await callOpenRouterAgent({
      messages: [
        { role: 'system', content: enrichedPrompt },
        { role: 'user', content: message }
      ],
      tools: CHAT_TOOLS,
      maxRounds: 4
    });

    res.json({
      response: content,
      toolCalls: trace.map(t => ({
        tool: t.name,
        input: t.input,
        hasResult: !!t.output && !t.error
      })),
      toolsCalled: trace.length,
      contextUsed: trace.length > 0,
      mfvcqMatched: trace.some(t => ['search_products', 'analyze_product', 'get_basfluxo_for_tests'].includes(t.name) && t.output)
    });

    // Auto-remember chat context (fire-and-forget)
    remember(`[Chat] Q: ${message.substring(0, 200)} → A: ${content.substring(0, 300)}`).catch(() => {});
  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
}
