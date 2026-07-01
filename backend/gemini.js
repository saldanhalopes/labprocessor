const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'google/gemini-2.5-flash';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as learning from './learning.js';
import { findSimilar } from './knowledge.js';
import { getBasfluxoForTests, analyzeProduct, searchProducts } from './mfvcq.js';
const __filedir = path.dirname(fileURLToPath(import.meta.url));

let enrichmentCache = null;
let enrichmentCacheTime = 0;
const CACHE_TTL_MS = 3600000; // 1 hour

function getEnrichment() {
  if (enrichmentCache && Date.now() - enrichmentCacheTime < CACHE_TTL_MS) return enrichmentCache;
  try {
    enrichmentCache = {
      patterns: learning.extractTimingPatterns(),
      stubs: learning.getRecentStubs(5),
      bias: learning.getBiasStats(),
      structural: learning.detectPatterns()
    };
    enrichmentCacheTime = Date.now();
  } catch (e) { /* learning module may not have data yet */ }
  return enrichmentCache || {};
}

function loadPrompts() {
  try {
    const fp = path.join(__filedir, 'config', 'prompts.json');
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch(e) { console.error('[Prompt] Load error:', e.message); }
  return null;
}

function loadTestConfig() {
  try {
    const fp = path.join(__filedir, 'config', 'tests.json');
    if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch(e) {}
  return {};
}

function loadBasfluxoRotas() {
  try {
    const fp = path.join(__filedir, 'reference', 'basefluxo_estruturado.json');
    if (!fs.existsSync(fp)) return {};
    const bf = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const rotasPorTeste = {};
    for (const forma of Object.values(bf)) {
      for (const [teste, data] of Object.entries(forma)) {
        if (teste === '_meta') continue;
        const atividades = Array.isArray(data) ? data : (data?.etapas ? data.etapas.flatMap(e => e.atividades || []) : []);
        if (atividades.length === 0) continue;
        rotasPorTeste[teste] = [...new Set(atividades.map(a => a.rota).filter(Boolean))];
      }
    }
    return rotasPorTeste;
  } catch(e) {}
  return {};
}

function loadBasfluxoAliases() {
  try {
    const fp = path.join(__filedir, 'reference', 'basefluxo_estruturado.json');
    if (!fs.existsSync(fp)) return {};
    const bf = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const aliasesPorTeste = {};
    for (const forma of Object.values(bf)) {
      const meta = forma._meta;
      if (!meta) continue;
      for (const [teste, m] of Object.entries(meta)) {
        if (m.aliases?.length > 0) aliasesPorTeste[teste] = m.aliases;
      }
    }
    return aliasesPorTeste;
  } catch(e) {}
  return {};
}

function buildDynamicExtractionGuide(lang) {
  const config = loadTestConfig();
  if (!Object.keys(config).length) return '';

  const labels = {
    pt: { heading: '## Referencia de Testes Conhecidos',
      tecnica: 'Tecnica', fixo: 'Fixo(min)', var: 'Var(min)', rotas: 'Rotas envolvidas',
      aliases: 'Tambem conhecido como', diretrizes: 'Diretrizes de extracao',
      freq: 'Extraido', timesGemini: 'Tempo Gemini (faixa)',
      timesBasfluxo: 'Tempo BASEFLUXO (faixa)',
      hints: '## Dicas de Calibracao (Aprendizado)',
      stubs: '## Testes Desconhecidos Recentes',
      biasNote: 'Gemini tende a SUBESTIMAR (tempos menores que o real). Considere adicionar ~15% ao t_run, especialmente para HPLC.' },
    es: { heading: '## Referencia de Pruebas Conocidas',
      tecnica: 'Tecnica', fixo: 'Fijo(min)', var: 'Var(min)', rotas: 'Rutas involucradas',
      aliases: 'Tambien conocido como', diretrizes: 'Directrices de extraccion',
      freq: 'Extraido', timesGemini: 'Tiempo Gemini (rango)',
      timesBasfluxo: 'Tiempo BASEFLUXO (rango)',
      hints: '## Sugerencias de Calibracion (Aprendizaje)',
      stubs: '## Pruebas Desconocidas Recientes',
      biasNote: 'Gemini tiende a SUBESTIMAR (tiempos menores que el real). Considere sumar ~15% al t_run, especialmente para HPLC.' },
    en: { heading: '## Known Test Reference',
      tecnica: 'Technique', fixo: 'Fixed(min)', var: 'Var(min)', rotas: 'Routes involved',
      aliases: 'Also known as', diretrizes: 'Extraction guidelines',
      freq: 'Extracted', timesGemini: 'Gemini Time (range)',
      timesBasfluxo: 'BASEFLUXO Time (range)',
      hints: '## Calibration Hints (Learned)',
      stubs: '## Recent Unknown Tests',
      biasNote: 'Gemini tends to UNDERESTIMATE (lower times than actual). Consider adding ~15% to t_run, especially for HPLC.' }
  };
  const l = labels[lang] || labels.pt;

  // Load enrichment data (cached, from learning journal)
  const enrichment = getEnrichment();

  // Load BASEFLUXO rotas (single source of truth)
  const basfluxoRotas = loadBasfluxoRotas();

  // Load BASEFLUXO aliases (from _meta)
  const basfluxoAliases = loadBasfluxoAliases();

  let guide = `\n${l.heading}\n\n`;
  guide += 'Use esta tabela para identificar e classificar os testes encontrados no PDF:\n\n';

  for (const [name, t] of Object.entries(config)) {
    if (t.status === 'stub') continue;
    const aliases = basfluxoAliases[name] || (t.aliases || []);
    const aliasesStr = aliases.join(', ');
    const rotas = basfluxoRotas[name] || [];
    const dirs = (t.diretrizes || []);
    const totalFixo = dirs.reduce((s, d) => s + (Number(d.fixo_min) || 0), 0);
    const totalVar = dirs.reduce((s, d) => s + (Number(d.var_min) || 0), 0);

    // Enrichment data from journal
    const p = (enrichment.patterns || {})[name];
    const freqStr = p ? ` [${l.freq}: ${p.count}x, Gemini: ${p.geminiTimeRange}]` : '';
    const learnedStr = t.learned_scale
      ? ` [Calibrado: scale=${t.learned_scale} (${t.learned_samples}x)]`
      : '';

    guide += `### ${name}${freqStr}${learnedStr}\n`;
    guide += `- ${l.tecnica}: ${t.tecnica || '?'}\n`;
    if (aliasesStr) guide += `- ${l.aliases}: ${aliasesStr}\n`;
    if (rotas.length) guide += `- ${l.rotas}: ${rotas.join(', ')}\n`;
    if (totalFixo + totalVar > 0) {
      guide += `- ${l.fixo}: ${totalFixo} | ${l.var}: ${totalVar}\n`;
    }
    if (dirs.length) {
      guide += `- ${l.diretrizes}:\n`;
      dirs.forEach(d => {
        guide += `  - **${d.componente}**: ${d.descricao || ''}`;
        if (d.heuristica) guide += ` [Heuristica: ${d.heuristica}]`;
        if (d.fixo_min) guide += ` (Fixo: ${d.fixo_min}min)`;
        if (d.var_min) guide += ` (Var: ${d.var_min}min)`;
        guide += '\n';
      });
    }
    guide += '\n';
  }

  // Add bias calibration hints
  const bias = enrichment.bias || {};
  const adjustments = bias.adjustments || [];
  const techSummary = bias.techSummary || [];
  if (adjustments.length > 0 || techSummary.length > 0 || (bias.globalAvgPct || 0) !== 0) {
    guide += `${l.hints}\n`;
    guide += `${l.biasNote}\n`;

    // Per-test adjustments with concrete multipliers
    if (adjustments.length > 0) {
      guide += '\nAjustes especificos por teste:\n';
      adjustments.filter(a => a.confidence === 'high' || a.count >= 3).forEach(a => {
        guide += `- **${a.testName}** (${a.technique}): ${a.recommendation} (vies: ${a.biasPct}%, ${a.count}x, confianca: ${a.confidence})\n`;
      });
      const mediumAdj = adjustments.filter(a => a.confidence === 'medium' || a.count === 2);
      if (mediumAdj.length) {
        guide += '\nAjustes preliminares (poucos dados):\n';
        mediumAdj.forEach(a => {
          guide += `- **${a.testName}**: ${a.recommendation} (vies: ${a.biasPct}%, ${a.count}x)\n`;
        });
      }
    }

    // Per-technique summary
    if (techSummary.length > 0) {
      guide += '\nResumo por tecnica:\n';
      techSummary.forEach(t => {
        guide += `- ${t.note} (${t.count}x)\n`;
      });
    }

    if (Math.abs(bias.globalAvgPct) >= 10) {
      guide += `\nVies global: ${bias.globalAvgPct > 0 ? '+' : ''}${bias.globalAvgPct}%\n`;
    }
    guide += '\n';
  }

  // Recent stubs section
  const stubs = enrichment.stubs || [];
  if (stubs.length > 0) {
    guide += `${l.stubs}\n`;
    guide += 'Estes testes apareceram recentemente e ainda nao tem correspondencia:\n';
    stubs.forEach(s => {
      guide += `- ${s.name} (visto pela 1a vez em ${s.productName})\n`;
    });
    guide += '\n';
  }

  // Co-occurrence and form patterns
  const structural = enrichment.structural || {};
  if (structural.ready) {
    const cooccur = structural.cooccurrences || [];
    if (cooccur.length) {
      guide += '## Co-ocorrencias Frequentes\n';
      guide += 'Pares de testes que frequentemente aparecem juntos no mesmo documento:\n';
      cooccur.slice(0, 5).forEach(c => {
        guide += `- **${c.tests[0]}** + **${c.tests[1]}**: ${c.count}x (${c.rate}% das extracoes)\n`;
      });
      guide += '\n';
    }

    const formData = structural.formTests || {};
    const formsWithData = Object.entries(formData).filter(([f, tests]) => tests.length >= 2);
    if (formsWithData.length) {
      guide += '## Testes Provaveis por Forma Farmaceutica\n';
      formsWithData.slice(0, 4).forEach(([form, tests]) => {
        guide += `### ${form}\n`;
        tests.slice(0, 5).forEach(t => {
          guide += `- ${t.name}: ${t.pct}% das extracoes\n`;
        });
      });
      guide += '\n';
    }

    const topStubs = structural.topStubs || [];
    if (topStubs.length) {
      guide += '## Stubs Mais Frequentes\n';
      guide += 'Testes desconhecidos que mais apareceram:\n';
      topStubs.slice(0, 5).forEach(s => {
        guide += `- ${s.name}: ${s.count}x\n`;
      });
      guide += '\n';
    }
  }

  return guide;
}

async function callOpenRouter({ messages, responseFormat }) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured in backend environment');
  }

  const body = {
    model: MODEL,
    messages
  };

  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

const getSystemPrompt = (language = 'pt') => {
  const prompts = loadPrompts();
  let dynamicGuide = buildDynamicExtractionGuide(language);

  // Guard: if dynamic guide is too large, truncate to avoid model output truncation
  // Gemini Flash has ~1M token context, but very long prompts increase JSON error risk
  const MAX_GUIDE_CHARS = 6000;
  if (dynamicGuide.length > MAX_GUIDE_CHARS) {
    console.log(`[Prompt] Guide truncated from ${dynamicGuide.length} to ${MAX_GUIDE_CHARS} chars`);
    dynamicGuide = dynamicGuide.slice(0, MAX_GUIDE_CHARS);
    // Try to cut at a clean section boundary
    const lastHash = dynamicGuide.lastIndexOf('\n## ');
    if (lastHash > MAX_GUIDE_CHARS * 0.7) {
      dynamicGuide = dynamicGuide.slice(0, lastHash);
    }
  }

  if (prompts && prompts[language]) return prompts[language] + '\n' + dynamicGuide;

  // Fallback built-in prompts (same as before)
  let langInstruction = "", langContext = "";
  switch (language) {
    case 'es':
      langInstruction = "IDIOMA DE SALIDA: ESPAÑOL. Todos os campos de texto devem estar em ESPAÑOL.";
      langContext = "Eres un Especialista Senior en Planificación de Control de Calidad Farmacéutico.";
      break;
    case 'en':
      langInstruction = "OUTPUT LANGUAGE: ENGLISH. All text fields must be in ENGLISH.";
      langContext = "You are a Senior Pharmaceutical Quality Control Planning Specialist.";
      break;
    default:
      langInstruction = "IDIOMA DE SAÍDA: PORTUGUÊS. Todos os campos de texto devem estar em PORTUGUÊS.";
      langContext = "Você é um Especialista Sênior em Planejamento de Controle de Qualidade Farmacêutico.";
      break;
  }

  return `# Role
${langContext}

# Objetivo
Analisar o PDF (Método Analítico/Monografia), extrair dados do PRODUTO, estimar tempos analíticos e listar REAGENTES.

# ${langInstruction}

# 1. Extração de Dados do Produto
- **Nome do Produto**
- **Código**
- **Forma Farmacêutica**
- **Princípios Ativos**
- **Composição**
- **Tamanho do Lote**

# 2. Extração de Testes e Tempos (em MINUTOS)
Componentes:
1. **t_prep**: Preparo (pesagem, diluição, ultrassom, plaqueamento).
2. **t_analysis**: Manuseio durante análise.
3. **t_run**: Tempo de corrida instrumental (HPLC) ou espera ativa.
4. **t_calc**: Cálculos.
5. **t_incubation**: Tempo de incubação passiva (Microbiologia).

# 3. Heurísticas
- **Microbiologia:** t_incubation = MAIOR tempo descrito (ex: 5-7 dias -> 10080 min).
- **HPLC:** t_run = Gradiente * Injeções.

# 4. Extração de Reagentes e Materiais
Liste os reagentes, solventes, fases móveis e meios de cultura mencionados.
- **name**: Nome do reagente/solução.
- **quantity**: Quantidade estimada com unidade de medida (ex: "500 mL", "10 g", "q.s.p."). Se não houver, use "-".
- **concentration**: Concentração (ex: "0.1 N", "10%"). Se não houver, use "-".
- **category**: "Reagente", "Solvente", "Meio de Cultura", "Fase Móvel".
- **testName**: Teste onde é utilizado.

# 5. Extração de Padrões (Standards)
- **name**: Nome do padrão (ex: "Padrão de Referência de Paracetamol").
- **amountmg**: Quantidade em mg do padrão pesada para preparo (ex: "50.5 mg"). Se não houver, use "-".
- **concentration**: Concentração da solução padrão preparada (ex: "0.5 mg/mL").
- **testName**: Teste onde é utilizado.

# 6. Extração de Equipamentos e Colunas Cromatográficas
- **name**: Nome/Tipo do equipamento ou descrição da coluna.
- **model**: Modelo ou dimensões citadas (ex: "C18 250x4.6mm 5µm").
- **category**: "Cromatógrafo", "Balança", "Dissolutor", "Espectrofotômetro", "Microscópio", "PH-metro", "Outros".
- **testName**: Teste onde é utilizado.

# 7. Conteúdo Integral
- **fullText**: Transcreva TODO o texto do documento de forma contínua e organizada.
- **visualContent**: Descreva todas as imagens, gráficos, tabelas e fluxogramas. Se não houver, use "Nenhuma imagem detectada".

# Formato de Saída (JSON)
Retorne APENAS um JSON válido seguindo estritamente este esquema:
{
  "product": {
    "productName": "string",
    "code": "string",
    "pharmaceuticalForm": "string",
    "activePrinciples": "string",
    "composition": "string",
    "batchSize": "string"
  },
  "rows": [
    {
      "id": 1,
      "testName": "string",
      "technique": "string",
      "category": "string",
      "details": "string",
      "t_prep": 0,
      "t_analysis": 0,
      "t_run": 0,
      "t_calc": 0,
      "t_incubation": 0,
      "rationale": "string"
    }
  ],
  "reagents": [
    { "name": "string", "quantity": "string", "concentration": "string", "category": "string", "testName": "string" }
  ],
  "standards": [
    { "name": "string", "amountmg": "string", "concentration": "string", "testName": "string" }
  ],
  "equipments": [
    { "name": "string", "model": "string", "category": "string", "testName": "string" }
  ],
  "fullText": "string",
  "visualContent": "string"
}`
    + '\n' + dynamicGuide;
};
function repairJSON(text, errorMsg) {
  const posMatch = errorMsg.match(/position (\d+)/);
  const errPos = posMatch ? parseInt(posMatch[1]) : -1;

  // Strategy 1: Try to fix the specific character at error position
  if (errPos > 0 && errPos < text.length) {
    // Common LLM JSON issues at error position:
    // - Unescaped newline inside a string
    // - Unescaped double quote inside a string
    // - Single quotes instead of double quotes
    // - Trailing comma before } or ]

    // Try fixing unescaped newlines (replace \n within strings)
    const fixed1 = fixUnescapedNewlines(text);
    try {
      const parsed = JSON.parse(fixed1);
      console.log('[OpenRouter] JSON repaired: unescaped newlines fixed');
      return parsed;
    } catch (e1) {}

    // Try removing trailing commas
    const fixed2 = text.replace(/,\s*([}\]])/g, '$1');
    try {
      const parsed = JSON.parse(fixed2);
      console.log('[OpenRouter] JSON repaired: trailing commas removed');
      return parsed;
    } catch (e2) {}

    // Try fixing at specific position: remove problematic character
    const fixed3 = text.slice(0, errPos) + text.slice(errPos + 1);
    try {
      const parsed = JSON.parse(fixed3);
      console.log('[OpenRouter] JSON repaired: removed char at error position');
      return parsed;
    } catch (e3) {}

    // Try inserting escape before position
    const fixed4 = text.slice(0, errPos - 1) + '\\' + text.slice(errPos - 1);
    try {
      const parsed = JSON.parse(fixed4);
      console.log('[OpenRouter] JSON repaired: inserted escape');
      return parsed;
    } catch (e4) {}
  }

  // Strategy 2: Try to salvage partial data (extract whatever parses)
  try {
    return salvagePartialJSON(text);
  } catch (e) { return null; }
}

function fixUnescapedNewlines(json) {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < json.length) {
    const ch = json[i];
    if (ch === '"' && (i === 0 || json[i - 1] !== '\\')) {
      inString = !inString;
      result += ch;
    } else if (ch === '\n' && inString) {
      result += '\\n';
    } else if (ch === '\r' && inString) {
      result += '\\r';
    } else {
      result += ch;
    }
    i++;
  }
  return result;
}

function salvagePartialJSON(text) {
  // Extract what we can: find complete objects for product, rows, reagents, etc.
  const extract = (key) => {
    const regex = new RegExp(`"${key}"\\s*:\\s*(\\[.*?\\]|\\{.*?\\})`, 's');
    const match = text.match(regex);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch (e) { return null; }
  };

  const product = (() => {
    const m = text.match(/"product"\s*:\s*(\{[^}]+\})/);
    if (!m) return {};
    try { return JSON.parse(m[1]); } catch (e) { return {}; }
  })();

  const rows = extract('rows') || [];
  const reagents = extract('reagents') || [];
  const standards = extract('standards') || [];
  const equipments = extract('equipments') || [];
  const fullText = extractStringField(text, 'fullText') || '';
  const visualContent = extractStringField(text, 'visualContent') || '';

  console.log(`[OpenRouter] Salvaged partial JSON: ${rows.length} rows, ${reagents.length} reagents`);
  return { product, rows, reagents, standards, equipments, fullText, visualContent };
}

function extractStringField(text, fieldName) {
  const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`);
  const match = text.match(regex);
  return match ? match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '';
}

export async function analyzeDocumentServer(base64Data, mimeType, fileName, language = 'pt') {
  try {
    const systemPrompt = getSystemPrompt(language);

    console.log(`[OpenRouter] Analyzing document: ${fileName}`);

    const text = await callOpenRouter({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analise este documento PDF e extraia os dados conforme o formato JSON especificado.' },
            { type: 'image_url', image_url: { url: `data:${mimeType || 'application/pdf'};base64,${base64Data}` } }
          ]
        }
      ],
      responseFormat: 'json'
    });

    if (!text) throw new Error("No response from OpenRouter");

    let cleanedText = text.trim();
    const jsonBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      cleanedText = jsonBlockMatch[1];
    } else {
      const start = cleanedText.indexOf('{');
      const end = cleanedText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        cleanedText = cleanedText.substring(start, end + 1);
      }
    }

    try {
      return JSON.parse(cleanedText);
    } catch (e) {
      console.error(`[OpenRouter] JSON Parse Error at pos ~${e.message.match(/position (\d+)/)?.[1] || '?'}: ${e.message.slice(0, 120)}`);
      // Save raw text for debugging
      const debugDir = path.join(__filedir, 'data', 'debug');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      const sanitized = fileName.replace(/[<>:"/\\|?*]/g, '_');
      fs.writeFileSync(path.join(debugDir, `${sanitized}_raw.txt`), text, 'utf-8');
      fs.writeFileSync(path.join(debugDir, `${sanitized}_cleaned.txt`), cleanedText, 'utf-8');
      console.log(`[OpenRouter] Saved raw output to data/debug/${sanitized}_*.txt`);

      // Attempt repair strategies
      const repaired = repairJSON(cleanedText, e.message);
      if (repaired) return repaired;

      throw new Error(`Model returned malformed JSON: ${e.message}`);
    }
  } catch (error) {
    console.error(`[OpenRouter] Error analyzing ${fileName}:`, error);
    throw error;
  }
}

export async function generateChatResponse(userMessage, context) {
  try {
    const systemPrompt = `Você é o "LabProcessor Chat", um assistente virtual especializado em análise de métodos analíticos da Eurofarma.

Seu objetivo é responder perguntas do usuário com base no CONTEXTO fornecido abaixo, que foi recuperado de documentos processados anteriormente.

REGRAS:
1. Use APENAS as informações do contexto para responder.
2. Se a informação não estiver no contexto, diga educadamente que não encontrou essa informação nos documentos processados.
3. Seja profissional, direto e use formatação markdown (tabelas, negrito, listas) para clareza.
4. Cite os nomes dos produtos ou arquivos quando houver múltiplos no contexto.
5. Se houver nomes de arquivos de imagem ou URLs no contexto, cite-os no formato Markdown:
   - Se for URL completa (com http), use exatamente: ![Imagem](URL)
   - Se for nome local, adicione o prefixo: ![Imagem](/images/NOME_DO_ARQUIVO)

CONTEXTO RECUPERADO:
${JSON.stringify(context, null, 2)}`;

    const text = await callOpenRouter({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    });

    return text;
  } catch (error) {
    console.error('[OpenRouter Chat] Error:', error);
    throw error;
  }
}

// ================================================================
// AGENTIC EXTRACTION TOOLS
// ================================================================

export const EXTRACTION_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup_test',
      description: 'Busca um nome de teste no knowledge vault. Retorna o teste padronizado correspondente com aliases, tecnica, rotas e learned_scale. Retorna null se o teste for desconhecido (vira STUB).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do teste como aparece no PDF (ex: "Doseamento HPLC", "Peso Medio")' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_basfluxo_times',
      description: 'Obtem os tempos calibrados do BASEFLUXO para um teste especifico: fixo (padrao/calibracao, executa 1x) e variavel (amostras, executa por lote). Retorna learned_scale quando disponivel.',
      parameters: {
        type: 'object',
        properties: {
          test: { type: 'string', description: 'Nome padronizado do teste (ex: "TEOR HPLC 1")' },
          lotes: { type: 'number', description: 'Numero de lotes (opcional, default=1). Se omitido, usa demanda do MFVCQ.' }
        },
        required: ['test']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_test_history',
      description: 'Retorna o historico de extracoes de um teste: quantas vezes apareceu, faixa de tempos do Gemini, vies medio, e learned_scale atual.',
      parameters: {
        type: 'object',
        properties: {
          test: { type: 'string', description: 'Nome padronizado do teste (ex: "TEOR HPLC 1")' }
        },
        required: ['test']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'classify_technique',
      description: 'Classifica a tecnica analitica e categoria de um teste baseado em palavras-chave na descricao.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Descricao ou nome do teste para classificar' }
        },
        required: ['description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_product_context',
      description: 'Obtem o contexto MFVCQ de um produto: celula de producao, demanda mensal, demanda em lotes.',
      parameters: {
        type: 'object',
        properties: {
          ativo: { type: 'string', description: 'Nome do principio ativo (ex: "HEMOLENTA", "CLOZAPINA")' }
        },
        required: ['ativo']
      }
    }
  }
];

function classifyTechnique(description) {
  const d = (description || '').toUpperCase();
  if (d.includes('HPLC') || d.includes('CROMATOGRA') || d.includes('DOSEAMENTO') || d.includes('TEOR')) return { technique: 'HPLC', category: 'Fisico-Quimico' };
  if (d.includes('DISSOL') || d.includes('DISOLUC')) return { technique: 'Dissolucao', category: 'Fisico-Quimico' };
  if (d.includes('DESINTEGR')) return { technique: 'Fisica', category: 'Fisico-Quimico' };
  if (d.includes('DUREZA')) return { technique: 'Fisica', category: 'Fisico-Quimico' };
  if (d.includes('FRIABIL')) return { technique: 'Fisica', category: 'Fisico-Quimico' };
  if (d.includes('PESO MEDIO') || d.includes('PESO MÉDIO')) return { technique: 'Gravimetria', category: 'Fisico-Quimico' };
  if (d.includes('UMIDADE') || d.includes('KARL')) return { technique: 'Karl Fischer', category: 'Fisico-Quimico' };
  if (d.includes('PH')) return { technique: 'Potenciometria', category: 'Fisico-Quimico' };
  if (d.includes('MICROBIOL') || d.includes('ESTERILID')) return { technique: 'Microbiologia', category: 'Microbiologia' };
  if (d.includes('ENDOTOXINA') || d.includes('LAL')) return { technique: 'LAL', category: 'Microbiologia' };
  if (d.includes('ESPECTRO') || d.includes('UV') || d.includes('VIS')) return { technique: 'Espectrofotometria', category: 'Fisico-Quimico' };
  if (d.includes('PARTICULA') || d.includes('TAMANHO') || d.includes('DIFRACAO') || d.includes('MALVERN')) return { technique: 'Difracao Laser', category: 'Fisico-Quimico' };
  if (d.includes('VISUAL') || d.includes('APARENCIA') || d.includes('DESCRICAO') || d.includes('DESCRIÇÃO')) return { technique: 'Visual', category: 'Fisico-Quimico' };
  return { technique: 'Outros', category: 'Fisico-Quimico' };
}

export async function executeExtractionTools(toolCalls) {
  const results = await Promise.all(toolCalls.map(async (tc) => {
    const { name, arguments: args } = tc.function;
    let parsed = {};
    try { parsed = JSON.parse(args); } catch (e) { parsed = {}; }

    try {
      switch (name) {
        case 'lookup_test': {
          const match = findSimilar(parsed.name);
          return {
            tool_call_id: tc.id,
            name,
            input: parsed.name,
            output: match ? { test: match.teste, score: match.score, source: match.source } : null,
            meta: match ? { technique: null } : { isStub: true }
          };
        }

        case 'get_basfluxo_times': {
          const bf = getBasfluxoForTests({
            ativo: parsed.test,
            forma: 'Sólidos',
            geminiRows: [{ testName: parsed.test, t_prep: 0, t_analysis: 0, t_run: 0, t_calc: 0, t_incubation: 0 }],
            lotes: parsed.lotes || 1
          });
          const t = bf?.testes?.[0];
          const learnedScale = t?.learned_scale || null;
          return {
            tool_call_id: tc.id,
            name,
            input: parsed.test,
            output: t ? {
              test: t.teste,
              fixo_total_min: t.fixo?.total_min,
              var_total_min: t.variavel?.total_min,
              total_calibrado_min: t.total_compartilhado_min,
              basfluxo_raw_min: t.basfluxoTotalMin,
              learned_scale: learnedScale,
              lotes: bf.quantidade_lotes
            } : null
          };
        }

        case 'get_test_history': {
          const patterns = learning.extractTimingPatterns();
          const p = patterns[parsed.test];
          return {
            tool_call_id: tc.id,
            name,
            input: parsed.test,
            output: p ? {
              count: p.count,
              geminiTimeRange: p.geminiTimeRange,
              avgBiasPct: p.avgBiasPct || 0,
              learnedScale: p.learnedScale || null
            } : { count: 0, geminiTimeRange: 'N/A', avgBiasPct: 0, learnedScale: null }
          };
        }

        case 'classify_technique': {
          const result = classifyTechnique(parsed.description);
          return {
            tool_call_id: tc.id,
            name,
            input: parsed.description,
            output: result
          };
        }

        case 'get_product_context': {
          const ctx = analyzeProduct({ ativo: parsed.ativo });
          return {
            tool_call_id: tc.id,
            name,
            input: parsed.ativo,
            output: ctx ? {
              celula: ctx.celula,
              demanda_media: ctx.demanda?.media_12_meses,
              demanda_lotes: ctx.demanda?.demanda_em_lotes,
              forma: ctx.forma_farmaceutica
            } : null
          };
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

export async function callOpenRouterAgent({ messages, tools, responseFormat, maxRounds = 5 }) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured in backend environment');
  }

  const trace = [];
  let currentMessages = [...messages];
  let finalContent = null;

  for (let round = 1; round <= maxRounds; round++) {
    const body = {
      model: MODEL,
      messages: currentMessages,
      tools,
      tool_choice: round < maxRounds ? 'auto' : 'none'
    };

    if (responseFormat === 'json' && round >= maxRounds) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const msg = data.choices[0].message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      console.log(`[Agent] Round ${round}: ${msg.tool_calls.length} tool calls`);

      currentMessages.push(msg);
      const toolResults = await executeExtractionTools(msg.tool_calls);

      toolResults.forEach(tr => {
        trace.push({ round, ...tr });
        currentMessages.push({
          role: 'tool',
          tool_call_id: tr.tool_call_id,
          content: JSON.stringify(tr.output || { error: tr.error })
        });
      });

      // After last tool round, instruct model to produce final JSON
      if (round >= maxRounds - 1) {
        currentMessages.push({
          role: 'user',
          content: 'Agora gere o JSON final com TODOS os dados extraidos: product, rows (com matchedBasfluxo e stub), reagents, standards, equipments, fullText, visualContent. Use os resultados das ferramentas para preencher matchedBasfluxo=true/false e stub=true/false em cada row. Retorne APENAS o JSON, sem texto adicional.'
        });
      }
    } else {
      finalContent = msg.content;
      console.log(`[Agent] Round ${round}: final response`);
      break;
    }
  }

  if (!finalContent) {
    throw new Error('Agent did not produce a final response within max rounds');
  }

  return { content: finalContent, trace, rounds: trace.length > 0 ? Math.max(...trace.map(t => t.round)) : 1 };
}

export function getExtractionSystemPrompt(language = 'pt') {
  const prompts = loadPrompts();
  const langInstruction = language === 'es' ? 'ESPAÑOL' : language === 'en' ? 'ENGLISH' : 'PORTUGUÊS';

  const base = `# Role
Você é um Especialista Sênior em Planejamento de Controle de Qualidade Farmacêutico.

# Objetivo
Analisar o PDF de Método Analítico e extrair dados estruturados. Use as FERRAMENTAS disponíveis para consultar o conhecimento acumulado - NÃO tente adivinhar nomes de testes.

# IDIOMA DE SAÍDA: ${langInstruction}

# Processo Obrigatório
1. Extraia os dados do PRODUTO (nome, codigo, forma farmaceutica, ativos)
2. Liste TODOS os testes do PDF. Para CADA teste, chame a ferramenta \`lookup_test\` com o nome do teste como aparece no documento
3. Para cada teste que teve match no vault, chame \`get_basfluxo_times\` para obter tempos calibrados e \`get_test_history\` para ver o historico
4. Use \`classify_technique\` quando o PDF nao deixar clara a tecnica
5. Para testes SEM match (\`lookup_test\` retornou null), marque como stub e estime os tempos mesmo assim

# Formato de Saída (JSON final)
APOS receber os resultados das ferramentas, gere APENAS o JSON abaixo.
NAO inclua texto, explicacoes ou marcadores markdown. APENAS JSON puro.
O campo "matchedBasfluxo" deve ser true se lookup_test encontrou match, false se for stub.
O campo "stub" deve ser true se lookup_test retornou null (teste desconhecido).
O campo "transcriptSummary" deve ser um objeto com resumos de 2-4 frases nos 3 idiomas (pt, es, en). Extraia do PDF o que o documento descreve sobre cada metodo (principio, condicoes, reagentes, equipamentos).
{
  "product": {
    "productName": "string",
    "code": "string",
    "pharmaceuticalForm": "string",
    "activePrinciples": "string",
    "composition": "string",
    "batchSize": "string"
  },
  "rows": [{
    "id": 1,
    "testName": "string",
    "technique": "string",
    "category": "string",
    "details": "string",
    "t_prep": 0, "t_analysis": 0, "t_run": 0, "t_calc": 0, "t_incubation": 0,
    "rationale": "string",
    "transcriptSummary": { "pt": "string", "es": "string", "en": "string" },
    "matchedBasfluxo": true,
    "stub": false
  }],
  "reagents": [{ "name": "string", "quantity": "string", "concentration": "string", "category": "string", "testName": "string" }],
  "standards": [{ "name": "string", "amountmg": "string", "concentration": "string", "testName": "string" }],
  "equipments": [{ "name": "string", "model": "string", "category": "string", "testName": "string" }],
  "fullText": "string",
  "visualContent": "string"
}`;

  if (prompts && prompts[language]) {
    return prompts[language] + '\n\n# FERRAMENTAS DISPONIVEIS\nUse as funcoes listadas para consultar o vault, BASEFLUXO, e historico de aprendizado.';
  }

  return base;
}

export async function analyzeDocumentAgent(base64Data, mimeType, fileName, language = 'pt') {
  try {
    const systemPrompt = getExtractionSystemPrompt(language);

    console.log(`[Agent] Analyzing document: ${fileName}`);

    const { content, trace } = await callOpenRouterAgent({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analise este documento PDF. Siga o processo obrigatorio: extraia o produto, liste os testes, chame lookup_test para cada um, depois get_basfluxo_times e get_test_history para os que tiveram match.' },
            { type: 'image_url', image_url: { url: `data:${mimeType || 'application/pdf'};base64,${base64Data}` } }
          ]
        }
      ],
      tools: EXTRACTION_TOOLS,
      responseFormat: 'json'
    });

    if (!content) throw new Error("No response from agent");

    let cleanedText = content.trim();
    const jsonBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      cleanedText = jsonBlockMatch[1];
    } else {
      const start = cleanedText.indexOf('{');
      const end = cleanedText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        cleanedText = cleanedText.substring(start, end + 1);
      }
    }

    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch (e) {
      console.error(`[Agent] JSON Parse Error: ${e.message.slice(0, 120)}`);
      const debugDir = path.join(__filedir, 'data', 'debug');
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      const sanitized = fileName.replace(/[<>:"/\\|?*]/g, '_');
      fs.writeFileSync(path.join(debugDir, `${sanitized}_agent_raw.txt`), content, 'utf-8');

      const repaired = repairJSON(cleanedText, e.message);
      if (repaired) result = repaired;
      else throw new Error(`Agent returned malformed JSON: ${e.message}`);
    }

    result._trace = trace;
    result._rounds = trace.length > 0 ? Math.max(...trace.map(t => t.round)) : 1;
    result._toolsCalled = trace.length;
    result._agentic = true;

    console.log(`[Agent] Extraction complete: ${result.rows?.length || 0} rows, ${trace.length} tool calls, ${result._rounds} rounds`);
    return result;
  } catch (error) {
    console.error(`[Agent] Error analyzing ${fileName}:`, error.message);
    console.log(`[Agent] Falling back to monolithic extraction for ${fileName}`);
    return analyzeDocumentServer(base64Data, mimeType, fileName, language);
  }
}

export async function generateTranscriptSummaries(fullText, rows, language = 'pt') {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }
  if (!fullText || !rows?.length) return rows;

  const testNames = rows.map(r => r.testName).filter(Boolean).join('", "');

  const prompt = `Voce e um especialista em metodos analiticos farmaceuticos.
Abaixo esta a transcricao completa de um documento de metodo analitico.

# Documento transcrito:
${fullText.slice(0, 15000)}

# Testes identificados no documento:
"${testNames}"

# Tarefa:
Para CADA teste listado acima, encontre no documento transcrito o trecho que descreve o metodo daquele teste e produza um resumo de 2-4 frases em TODOS os 3 idiomas: Portugues (pt), Espanhol (es) e Ingles (en).
Cada resumo deve incluir: principio do metodo, condicoes principais, reagentes/equipamentos chave.

Retorne APENAS um objeto JSON neste formato, sem texto adicional:
{
  "summaries": {
    "Nome do Teste 1": { "pt": "Resumo em portugues...", "es": "Resumen en espanol...", "en": "Summary in english..." },
    "Nome do Teste 2": { "pt": "Resumo em portugues...", "es": "Resumen en espanol...", "en": "Summary in english..." }
  }
}

IMPORTANTE: Cada teste DEVE ter os 3 idiomas preenchidos. Nao deixe nenhum vazio.`;

  try {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'Voce retorna APENAS JSON. Sem texto adicional.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 8192
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    let content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    const parsed = JSON.parse(content);
    const summaries = parsed.summaries || {};

    return rows.map(row => ({
      ...row,
      transcriptSummary: summaries[row.testName] || row.transcriptSummary || { pt: '', es: '', en: '' }
    }));
  } catch (error) {
    console.error('[TranscriptSummary] Error:', error.message);
    return rows;
  }
}
