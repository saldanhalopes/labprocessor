import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://labprocessor:labprocessor@localhost:5432/labprocessor'
});

let genAI = null;

function initGemini() {
  if (!GEMINI_API_KEY) {
    console.warn('[PGVector] No Gemini API key configured. Embedding generation disabled.');
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

async function generateEmbedding(text) {
  const ai = initGemini();
  if (!ai) throw new Error('Gemini API key not configured');
  const model = ai.getGenerativeModel({ model: 'models/gemini-embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export async function queryVectors(queryText, topK = 5) {
  try {
    const queryValues = await generateEmbedding(queryText);
    const result = await pool.query(`
      SELECT e.id, e.chunk_text, e.metadata, e.result_id,
        1 - (e.embedding <=> $1::vector) AS similarity
      FROM embeddings e
      ORDER BY e.embedding <=> $1::vector
      LIMIT $2
    `, [`[${queryValues.join(',')}]`, topK]);

    return result.rows.map(row => ({
      id: row.id.toString(),
      score: row.similarity,
      metadata: row.metadata || {}
    }));
  } catch (error) {
    console.error('[PGVector] Query failed:', error);
    return [];
  }
}

export async function saveToPinecone(result) {
  try {
    const vectors = [];
    for (let i = 0; i < (result.rows || []).length; i++) {
      const row = result.rows[i];
      const textToEmbed = `
        Product: ${result.product?.productName || ''}
        Test: ${row.testName}
        Technique: ${row.technique}
        Rationale: ${row.rationale || ''}
        Composition: ${result.product?.composition || ''}
      `.trim();

      let values;
      try {
        values = await generateEmbedding(textToEmbed);
      } catch (e) {
        console.warn(`[PGVector] Embedding failed for row ${i}: ${e.message}`);
        continue;
      }

      vectors.push({
        resultId: result.fileId,
        chunkText: textToEmbed,
        embedding: values,
        metadata: {
          fileId: result.fileId,
          fileName: result.fileName,
          productName: result.product?.productName || '',
          testName: row.testName,
          technique: row.technique
        }
      });
    }

    if (vectors.length > 0) {
      await pool.query('DELETE FROM embeddings WHERE result_id = $1', [result.fileId]);
      for (const v of vectors) {
        await pool.query(`
          INSERT INTO embeddings (result_id, chunk_text, embedding, metadata)
          VALUES ($1, $2, $3::vector, $4)
        `, [v.resultId, v.chunkText, `[${v.embedding.join(',')}]`, JSON.stringify(v.metadata)]);
      }
      console.log(`[PGVector] Synced ${vectors.length} vectors for ${result.fileName}`);
    }
    return true;
  } catch (error) {
    console.error('[PGVector] Sync failed:', error);
    return false;
  }
}
