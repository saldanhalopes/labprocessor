import { queryVectors } from './pgvector.js';
import { generateChatResponse } from './gemini.js';

export async function handleChatMessage(req, res) {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log(`[Chat] Processing message: "${message.substring(0, 50)}..."`);
    const matches = await queryVectors(message, 5);

    const context = matches.map(m => ({
      product: m.metadata?.productName || '',
      test: m.metadata?.testName || '',
      technique: m.metadata?.technique || '',
      score: m.score || 0
    }));

    const responseText = await generateChatResponse(message, context);

    res.json({
      response: responseText,
      contextUsed: context.length > 0
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({ error: 'Failed to generate chat response' });
  }
}
