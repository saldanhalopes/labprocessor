/**
 * Backend Gemini analysis service.
 * Handles document processing and extraction server-side.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

function initGemini() {
  if (!GEMINI_API_KEY) {
    console.error('[Gemini] GEMINI_API_KEY not found in process.env');
    throw new Error('GEMINI_API_KEY not configured in backend environment');
  }
  console.log(`[Gemini] Initializing with API key (length: ${GEMINI_API_KEY.length})`);
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

const getSystemPrompt = (language = 'pt') => {
  let langInstruction = "";
  let langContext = "";
  let structureLang = "";

  switch (language) {
    case 'es':
      langInstruction = "DATOS DESCRIPTIVOS: IDIOMA ORIGINAL DEL DOCUMENTO. CATEGORÍAS TÉCNICAS: ESPAÑOL.";
      langContext = "Eres un Especialista Senior en Planificación de Control de Calidad Farmacéutico.";
      structureLang = "ESPAÑOL";
      break;
    case 'en':
      langInstruction = "DESCRIPTIVE DATA: DOCUMENT'S ORIGINAL LANGUAGE. TECHNICAL CATEGORIES: ENGLISH.";
      langContext = "You are a Senior Pharmaceutical Quality Control Planning Specialist.";
      structureLang = "ENGLISH";
      break;
    default: // pt
      langInstruction = "DADOS DESCRITIVOS: IDIOMA ORIGINAL DO DOCUMENTO. CATEGORIAS TÉCNICAS: PORTUGUÊS.";
      langContext = "Você é um Especialista Sênior em Planejamento de Controle de Qualidade Farmacêutico.";
      structureLang = "PORTUGUÊS";
      break;
  }

  return `
# ROLE
${langContext}

# OBJETIVO
Analisar o PDF (Método Analítico/Monografia), extrair dados do PRODUTO, estimar tempos analíticos e listar REAGENTES.

# REGRAS DE IDIOMA
${langInstruction}
- **CAMPOS DE CONTEÚDO (Mantenha o idioma do PDF):** productName, testName, technique, details, rationale, fullText, visualContent.
- **CAMPOS ESTRUTURAIS (Use ${structureLang}):** rows.category, reagents.category, equipments.category.

# 1. Extração de Dados do Produto
- **Nome do Produto** (Original do doc)
- **Código**
- **Forma Farmacêutica** (Original do doc)
- **Princípios Ativos** (Original do doc)
- **Composição** (Original do doc)

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
- **name**: Nome do reagente/solução (Original do doc).
- **quantity**: Quantidade estimada (Original do doc).
- **category**: Use EXATAMENTE: "Reagente", "Solvente", "Meio de Cultura", "Fase Móvel".
- **testName**: Teste onde é utilizado (Original do doc).

# 5. Extração de Padrões (Standards)
- **name**: Nome do padrão (Original do doc).
- **amountmg**: Quantidade em mg (Original do doc).
- **testName**: Teste onde é utilizado (Original do doc).

# 6. Extração de Equipamentos e Colunas Cromatográficas
Identifique e classifique os equipamentos citados no método.
- **name**: Nome/Tipo do equipamento ou descrição da coluna (Original do doc).
- **category**: Use EXATAMENTE: "Cromatógrafo", "Coluna Cromatográfica", "Balança", "Dissolutor", "Espectrofotômetro", "Microscópio", "PH-metro", "Outros".
- **testName**: Teste onde é utilizado (Original do doc).

# 7. Conteúdo Integral
- **fullText**: Transcreva TODO o texto do documento no IDIOMA ORIGINAL.
- **visualContent**: Descreva as imagens no IDIOMA ORIGINAL.

# Formato de Saída (JSON)
Retorne APENAS um JSON válido:
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
      "id": number,
      "testName": "string",
      "technique": "string",
      "category": "Físico-Químico" | "Microbiologia",
      "details": "string",
      "t_prep": number,
      "t_analysis": number,
      "t_run": number,
      "t_calc": number,
      "t_incubation": number,
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
}
`;
};

const getChatSystemPrompt = (context, language = 'pt') => {
  let role = "";
  let rules = "";
  let goals = "";
  let contextLabel = "";
  let rulesLabel = "";
  
  switch (language) {
    case 'es':
      role = 'Eres el "LabProcessor Chat", un asistente virtual especializado en el análisis de métodos analíticos de Eurofarma.';
      rules = `
        1. Utilice ÚNICAMENTE la información del contexto para responder.
        2. Si la información no está en el contexto, diga educadamente que no encontró esa información.
        3. Sea profesional, directo y utilice formato markdown (tablas, negrita, listas) para mayor claridad.
        4. Mencione los nombres de los productos o archivos cuando haya varios en el contexto.
      `;
      goals = "Su objetivo es responder a las preguntas de los usuarios basándose en el CONTEXTO que se proporciona a continuación.";
      contextLabel = "CONTEXTO RECUPERADO:";
      rulesLabel = "REGLAS:";
      break;
    case 'en':
      role = 'You are "LabProcessor Chat", a virtual assistant specializing in Eurofarma analytical method analysis.';
      rules = `
        1. Use ONLY the information in the context to answer.
        2. If the information is not in the context, politely say that you did not find that information.
        3. Be professional, direct, and use markdown formatting (tables, bold, lists) for clarity.
        4. Mention product or file names when there are multiples in the context.
      `;
      goals = "Your goal is to answer user questions based on the CONTEXT provided below.";
      contextLabel = "RETRIEVED CONTEXT:";
      rulesLabel = "RULES:";
      break;
    default: // pt
      role = 'Você é o "LabProcessor Chat", um assistente virtual especializado em análise de métodos analíticos da Eurofarma.';
      rules = `
        1. Use APENAS as informações do contexto para responder.
        2. Se a informação não estiver no contexto, diga educadamente que não encontrou essa informação.
        3. Seja profissional, direto e use formatação markdown (tabelas, negrito, listas) para clareza.
        4. Cite os nomes dos produtos ou arquivos quando houver múltiplos no contexto.
      `;
      goals = "Seu objetivo é responder perguntas do usuário com base no CONTEXTO fornecido abaixo.";
      contextLabel = "CONTEXTO RECUPERADO:";
      rulesLabel = "REGRAS:";
      break;
  }

  return `
    ${role}
    
    ${goals}
    
    ${rulesLabel}
    ${rules}
    
    ${contextLabel}
    ${JSON.stringify(context, null, 2)}
  `;
};

async function parseGeminiJson(text, fileName) {
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
    console.error(`[Gemini-Server] First JSON parse failed. Attempting fixes...`);
    
    let fixedText = cleanedText;
    
    fixedText = fixedText.replace(/,(\s*[}\]])/g, '$1');
    fixedText = fixedText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    fixedText = fixedText.replace(/([^\\])"([^"\n]*)\n/g, '$1"$2\\n');
    fixedText = fixedText.replace(/[\x00-\x1F\x7F]/g, '');
    
    try {
      return JSON.parse(fixedText);
    } catch (e2) {
      console.error(`[Gemini-Server] JSON parse failed after fixes: ${e2.message}`);
      throw new Error(`Gemini returned malformed JSON: ${e.message}`);
    }
  }
}

async function analyzeWithModel(genAI, modelName, systemPrompt, base64Data) {
  const model = genAI.getGenerativeModel({ 
    model: modelName,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
    systemInstruction: systemPrompt,
    generationConfig: { 
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 80000
    }
  });

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: "application/pdf"
      }
    }
  ]);

  const response = await result.response;
  const text = response.text();
  
  if (!text) throw new Error("No response from Gemini");
  
  return text;
}

export async function analyzeDocumentServer(base64Data, mimeType, fileName, language = 'pt') {
  try {
    const genAI = initGemini();
    const systemPrompt = getSystemPrompt(language);
    
    const models = ['models/gemini-2.5-flash'];
    
    for (const modelName of models) {
      try {
        console.log(`[Gemini-Server] Analyzing ${fileName} with ${modelName}`);
        
        const text = await analyzeWithModel(genAI, modelName, systemPrompt, base64Data);
        
        return await parseGeminiJson(text, fileName);
      } catch (error) {
        console.error(`[Gemini-Server] Failed with ${modelName}: ${error.message}`);
        
        if (modelName === models[models.length - 1]) {
          throw error;
        }
        console.log(`[Gemini-Server] Retrying with next model...`);
      }
    }
  } catch (error) {
    console.error(`[Gemini-Server] Error analyzing ${fileName}:`, error);
    throw error;
  }
}

export async function generateChatResponse(userMessage, context, language = 'pt') {
  try {
    const modelName = 'models/gemini-2.5-flash';
    console.log(`[Gemini-Chat] Starting generation (lang: ${language}) with model: ${modelName}`);
    
    const genAI = initGemini();
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: getChatSystemPrompt(context, language),
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    const result = await model.generateContent([{ text: userMessage }]);
    const response = await result.response;
    const text = response.text();
    console.log(`[Gemini-Chat] Successfully generated response (length: ${text?.length || 0})`);
    return text;
  } catch (error) {
    console.error('[Gemini-Chat] CRITICAL Error:', error.message);
    if (error.message.includes('not found') || error.message.includes('404')) {
      console.error('[Gemini-Chat] HINT: The model name "gemini-2.5-flash" might be invalid or not available in this region/API version.');
    }
    throw error;
  }
}
