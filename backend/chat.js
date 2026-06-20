import { queryVectors } from './pgvector.js';
import { generateChatResponse } from './gemini.js';
import { analyzeProduct, searchProducts, getIndices } from './mfvcq.js';

export async function handleChatMessage(req, res) {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log(`[Chat] Processing message: "${message.substring(0, 50)}..."`);

    // Check if the message is about MFVCQ
    const indices = getIndices();
    const msgUpper = message.toUpperCase();
    const matchedAtivo = (indices.ativos || []).find(a => msgUpper.includes(a));

    let mfvcqContext = null;
    if (matchedAtivo) {
      console.log(`[Chat] Detected MFVCQ query for: ${matchedAtivo}`);
      mfvcqContext = analyzeProduct({ ativo: matchedAtivo });
    }

    // Retrieve RAG context from pgvector
    const matches = await queryVectors(message, 3);

    const context = matches.map(m => ({
      product: m.metadata?.productName || '',
      test: m.metadata?.testName || '',
      technique: m.metadata?.technique || '',
      score: m.score || 0
    }));

    // Build augmented context
    let augmentedContext = context;
    if (mfvcqContext) {
      augmentedContext = [
        ...context,
        {
          product: `MFVCQ - ${mfvcqContext.ativo}`,
          test: 'Análise de Demanda e CQ',
          technique: 'MFVCQ',
          score: 1.0,
          mfvcqData: {
            celula: mfvcqContext.celula,
            demanda: mfvcqContext.demanda,
            resumo_tempos: mfvcqContext.resumo_tempos,
            totalTestes: mfvcqContext.analises_cq?.length || 0
          }
        }
      ];
    }

    const responseText = await generateChatResponse(message, augmentedContext);

    res.json({
      response: responseText,
      contextUsed: augmentedContext.length > 0,
      mfvcqMatched: !!matchedAtivo
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
}
