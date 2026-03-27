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

  switch (language) {
    case 'es':
      langInstruction = "IDIOMA DE SALIDA: ESPAÑOL. Todos os campos de texto devem estar em ESPAÑOL.";
      langContext = "Eres un Especialista Senior en Planificación de Control de Calidad Farmacéutico.";
      break;
    case 'en':
      langInstruction = "OUTPUT LANGUAGE: ENGLISH. All text fields must be in ENGLISH.";
      langContext = "You are a Senior Pharmaceutical Quality Control Planning Specialist.";
      break;
    default: // pt
      langInstruction = "IDIOMA DE SAÍDA: PORTUGUÊS. Todos os campos de texto devem estar em PORTUGUÊS.";
      langContext = "Você é um Especialista Sênior em Planejamento de Controle de Qualidade Farmacêutico.";
      break;
  }

  return `
# Role
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
Identifique e classifique os equipamentos citados no método. Atenção especial a Colunas Cromatográficas (também descritas como "Column" ou "Columna").
- **name**: Nome/Tipo do equipamento ou descrição da coluna (ex: "Coluna Agilent Zorbax").
- **model**: Modelo ou dimensões citadas (ex: "C18 250x4.6mm 5µm"). Se não houver, use "-".
- **category**: "Cromatógrafo", "Coluna Cromatográfica", "Balança", "Dissolutor", "Espectrofotômetro", "Microscópio", "PH-metro", "Outros".
- **testName**: Teste onde é utilizado.

# 7. Conteúdo Integral (Texto e Imagens)
- **fullText**: Transcreva TODO o texto do documento de forma contínua e organizada.
- **visualContent**: Descreva detalhadamente todas as imagens, logotipos, gráficos, tabelas visuais e fluxogramas presentes no documento. Se não houver imagens, use "Nenhuma imagem detectada".

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
      "id": number,
      "testName": "string",
      "technique": "string",
      "category": "string",
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
    {
      "name": "string",
      "quantity": "string",
      "concentration": "string",
      "category": "string",
      "testName": "string"
    }
  ],
  "standards": [
    {
      "name": "string",
      "amountmg": "string",
      "concentration": "string",
      "testName": "string"
    }
  ],
  "equipments": [
    {
      "name": "string",
      "model": "string",
      "category": "Cromatógrafo" | "Coluna Cromatográfica" | "Balança" | "Dissolutor" | "Espectrofotômetro" | "Microscópio" | "PH-metro" | "Outros",
      "testName": "string"
    }
  ],
  "fullText": "string",
  "visualContent": "string"
}
`;
};

/**
 * Handle document analysis server-side.
 */
export async function analyzeDocumentServer(base64Data, mimeType, fileName, language = 'pt') {
  try {
    const genAI = initGemini();
    const systemPrompt = getSystemPrompt(language);
    
    const model = genAI.getGenerativeModel({ 
      // IMPORTANTE: Sempre utilizar gemini-2.5-flash conforme solicitado pelo usuario. Nao alterar.
      model: 'models/gemini-2.5-flash',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: "application/json" }
    });

    console.log(`[Gemini-Server] Analyzing document: ${fileName} using models/gemini-2.5-flash`);
    
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

    let cleanedText = text.trim();
    
    // 1. Check for Markdown code blocks (```json ... ```)
    const jsonBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      cleanedText = jsonBlockMatch[1];
    } else {
      // 2. Try to find the first '{' and last '}'
      const start = cleanedText.indexOf('{');
      const end = cleanedText.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        cleanedText = cleanedText.substring(start, end + 1);
      }
    }

    try {
      return JSON.parse(cleanedText);
    } catch (e) {
      console.error(`[Gemini-Server] JSON Parse Error at pos ${e.message.match(/position (\d+)/)?.[1] || 'unknown'}. Content Snippet: ${cleanedText.substring(0, 100)}...`);
      // If still fails, we could try harder cleaning (unescaping, fixing trailing commas)
      // but for now, we'll throw a clearer error.
      throw new Error(`Gemini returned malformed JSON: ${e.message}`);
    }
  } catch (error) {
    console.error(`[Gemini-Server] Error analyzing ${fileName}:`, error);
    throw error;
  }
}

/**
 * Generate a chat response based on retrieved context.
 */
export async function generateChatResponse(userMessage, context) {
  try {
    const genAI = initGemini();
    const model = genAI.getGenerativeModel({ 
      // IMPORTANTE: Sempre utilizar gemini-2.5-flash conforme solicitado pelo usuario. Nao alterar.
      model: 'models/gemini-2.5-flash',
      systemInstruction: `
        Você é o "LabProcessor Chat", um assistente virtual especializado em análise de métodos analíticos da Eurofarma.
        
        Seu objetivo é responder perguntas do usuário com base no CONTEXTO fornecido abaixo, que foi recuperado de documentos processados anteriormente.
        
        REGRAS:
        1. Use APENAS as informações do contexto para responder.
        2. Se a informação não estiver no contexto, diga educadamente que não encontrou essa informação nos documentos processados.
        3. Seja profissional, direto e use formatação markdown (tabelas, negrito, listas) para clareza.
        4. Cite os nomes dos produtos ou arquivos quando houver múltiplos no contexto.
        5. Se houver nomes de arquivos de imagem ou URLs no contexto (campo "images"), cite-os no formato MarkDown: 
           - **Importante**: Se o item for uma URL completa (que já contenha "http"), use-a exatamente como está: ![Imagem](URL)
           - Se for apenas um nome de arquivo local (sem http), adicione o prefixo: ![Imagem](/images/NOME_DO_ARQUIVO)
        
        CONTEXTO RECUPERADO:
        ${JSON.stringify(context, null, 2)}
      `
    });

    const result = await model.generateContent(userMessage);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('[Gemini-Chat] Error generating response:', error);
    throw error;
  }
}
