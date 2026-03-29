/**
 * Chat controller for RAG integration.
 */
import { queryVectors } from './pinecone.js';
import { generateChatResponse } from './gemini.js';

export async function handleChatMessage(req, res) {
  const { message, language = 'pt' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log(`[Chat] Processing message (lang: ${language}): "${message.substring(0, 50)}..."`);

    // 1. Retrieve context from Pinecone
    try {
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
      console.log(`[Chat] Querying Gemini with ${context.length} context matches...`);
      try {
        const responseText = await generateChatResponse(message, context, language);
        
        if (!responseText) {
          console.warn('[Chat] Gemini returned empty response');
        }

        res.json({ 
          response: responseText || 'O modelo não retornou uma resposta válida.',
          contextUsed: context.length > 0 
        });
      } catch (geminiError) {
        console.error('[Chat] Gemini generation error:', geminiError.message);
        res.status(500).json({ error: `IA Error: ${geminiError.message}` });
      }
    } catch (pineconeError) {
      console.error('[Chat] Pinecone retrieval error:', pineconeError.message);
      res.status(500).json({ error: `Context retrieval error: ${pineconeError.message}` });
    }
  } catch (error) {
    console.error('[Chat] General Error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
}
