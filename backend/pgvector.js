import pg from 'pg';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const EMBEDDING_MODEL = 'openai/text-embedding-3-large';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://labprocessor:labprocessor@localhost:5432/labprocessor'
});

export async function generateEmbedding(text) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  const res = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter embeddings error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function queryVectors(queryText, topK = 5) {
  if (!OPENROUTER_API_KEY) return [];

  try {
    const queryValues = await generateEmbedding(queryText);
    await pool.query('SET LOCAL hnsw.ef_search = 100');
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

export async function saveToPgVector(result) {
  if (!OPENROUTER_API_KEY) return false;

  try {
    const rows = result.rows || [];
    if (rows.length === 0) return false;

    const embedTasks = rows.map(async (row, i) => {
      const textToEmbed = `
        Product: ${result.product?.productName || ''}
        Test: ${row.testName}
        Technique: ${row.technique}
        Rationale: ${row.rationale || ''}
        Composition: ${result.product?.composition || ''}
      `.trim();

      try {
        const values = await generateEmbedding(textToEmbed);
        return {
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
        };
      } catch (e) {
        console.warn(`[PGVector] Embedding failed for row ${i}: ${e.message}`);
        return null;
      }
    });

    const results = await Promise.all(embedTasks);
    const vectors = results.filter(Boolean);

    if (vectors.length > 0) {
      await pool.query('DELETE FROM embeddings WHERE result_id = $1', [result.fileId]);

      const resultIds = vectors.map(v => v.resultId);
      const chunkTexts = vectors.map(v => v.chunkText);
      const embeddingArr = vectors.map(v => `[${v.embedding.join(',')}]`);
      const metadataArr = vectors.map(v => JSON.stringify(v.metadata));

      await pool.query(`
        INSERT INTO embeddings (result_id, chunk_text, embedding, metadata)
        SELECT * FROM unnest($1::text[], $2::text[], $3::vector[], $4::jsonb[])
      `, [resultIds, chunkTexts, embeddingArr, metadataArr]);

      console.log(`[PGVector] Synced ${vectors.length} vectors for ${result.fileName}`);
    }
    return true;
  } catch (error) {
    console.error('[PGVector] Sync failed:', error);
    return false;
  }
}
