/**
 * Chat controller for RAG integration.
 */
import { queryVectors } from './pinecone.js';
import { generateChatResponse } from './gemini.js';

export async function handleChatMessage(req, res) {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log(`[Chat] Processing message: "${message.substring(0, 50)}..."`);

    // 1. Retrieve context from Pinecone
    const matches = await queryVectors(message, 5);
    
    // 2. Extract metadata and text from matches
    const context = matches.map(m => ({
      product: m.metadata.productName,
      test: m.metadata.testName,
      technique: m.metadata.technique,
      fullText: m.metadata.fullText,
      visualContent: m.metadata.visualContent,
      images: m.metadata.images ? m.metadata.images.split(',') : []
    }));

    // 3. Generate response using Gemini with retrieved context
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
