const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'google/gemini-2.5-flash';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filedir = path.dirname(fileURLToPath(import.meta.url));

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
    pt: { heading: '## Referência de Testes Conhecidos',
      tecnica: 'Técnica', fixo: 'Fixo(min)', var: 'Var(min)', rotas: 'Rotas envolvidas',
      aliases: 'Também conhecido como', diretrizes: 'Diretrizes de extração' },
    es: { heading: '## Referencia de Pruebas Conocidas',
      tecnica: 'Técnica', fixo: 'Fijo(min)', var: 'Var(min)', rotas: 'Rutas involucradas',
      aliases: 'También conocido como', diretrizes: 'Directrices de extracción' },
    en: { heading: '## Known Test Reference',
      tecnica: 'Technique', fixo: 'Fixed(min)', var: 'Var(min)', rotas: 'Routes involved',
      aliases: 'Also known as', diretrizes: 'Extraction guidelines' }
  };
  const l = labels[lang] || labels.pt;

  let guide = `\n${l.heading}\n\n`;
  guide += 'Use esta tabela para identificar e classificar os testes encontrados no PDF:\n\n';

  for (const [name, t] of Object.entries(config)) {
    if (t.status === 'stub') continue;
    const aliases = (t.aliases || []).join(', ');
    const rotas = (t.rotas || []).map(r => r.nome || r).filter(Boolean);
    const dirs = (t.diretrizes || []);
    const totalFixo = dirs.reduce((s, d) => s + (Number(d.fixo_min) || 0), 0);
    const totalVar = dirs.reduce((s, d) => s + (Number(d.var_min) || 0), 0);

    guide += `### ${name}\n`;
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
        if (d.heuristica) guide += ` [Heurística: ${d.heuristica}]`;
        if (d.fixo_min) guide += ` (Fixo: ${d.fixo_min}min)`;
        if (d.var_min) guide += ` (Var: ${d.var_min}min)`;
        guide += '\n';
      });
    }
    guide += '\n';
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
  if (prompts && prompts[language]) return prompts[language] + '\n' + buildDynamicExtractionGuide(language);

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
}` + '\n' + buildDynamicExtractionGuide(language);
};

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
      console.error(`[OpenRouter] JSON Parse Error. Content: ${cleanedText.substring(0, 100)}...`);
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
