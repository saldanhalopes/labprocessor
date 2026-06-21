const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'google/gemini-2.5-flash';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as learning from './learning.js';
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

  let guide = `\n${l.heading}\n\n`;
  guide += 'Use esta tabela para identificar e classificar os testes encontrados no PDF:\n\n';

  for (const [name, t] of Object.entries(config)) {
    if (t.status === 'stub') continue;
    const aliases = (t.aliases || []).join(', ');
    const rotas = (t.rotas || []).map(r => r.nome || r).filter(Boolean);
    const dirs = (t.diretrizes || []);
    const totalFixo = dirs.reduce((s, d) => s + (Number(d.fixo_min) || 0), 0);
    const totalVar = dirs.reduce((s, d) => s + (Number(d.var_min) || 0), 0);

    // Enrichment data from journal
    const p = (enrichment.patterns || {})[name];
    const freqStr = p ? ` [${l.freq}: ${p.count}x, Gemini: ${p.geminiTimeRange}]` : '';

    guide += `### ${name}${freqStr}\n`;
    guide += `- ${l.tecnica}: ${t.tecnica || '?'}\n`;
    if (aliases) guide += `- ${l.aliases}: ${aliases}\n`;
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
- **category**: "Cromatógrafo", "Coluna Cromatográfica", "Balança", "Dissolutor", "Espectrofotômetro", "Microscópio", "PH-metro", "Outros".
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
