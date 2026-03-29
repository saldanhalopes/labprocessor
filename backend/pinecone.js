/**
 * Backend Pinecone integration service.
 * Handles embedding generation and vector storage server-side.
 */
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'labprocessor';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const TARGET_DIMENSION = 3072; // Dimension for gemini-embedding-001

let pc = null;
let genAI = null;
let indexReady = false;

async function ensureIndexExists(pinecone) {
  if (indexReady) return true;
  try {
    const list = await pinecone.listIndexes();
    const indexName = PINECONE_INDEX;
    const existingIndex = list.indexes?.find(idx => idx.name === indexName);

    if (existingIndex) {
      if (existingIndex.dimension !== TARGET_DIMENSION) {
        console.warn(`[Pinecone] Dimension mismatch: Index is ${existingIndex.dimension}, but model needs ${TARGET_DIMENSION}. Recreating...`);
        await pinecone.deleteIndex(indexName);
        // Wait for deletion to propagate
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log(`[Pinecone] Index "${indexName}" exists with correct dimensions.`);
        indexReady = true;
        return true;
      }
    }

    console.log(`[Pinecone] Creating index "${indexName}" with dimension ${TARGET_DIMENSION}...`);
    await pinecone.createIndex({
      name: indexName,
      dimension: TARGET_DIMENSION,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    // Poll until ready
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 30) {
      attempts++;
      const status = await pinecone.describeIndex(indexName);
      if (status.status?.ready) {
        ready = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    if (ready) {
      console.log(`[Pinecone] Index "${indexName}" is now ready.`);
      indexReady = true;
      return true;
    } else {
      throw new Error('Index creation timed out');
    }
  } catch (error) {
    console.error('[Pinecone] Failed to ensure index exists:', error);
    return false;
  }
}

function initPinecone() {
  if (!PINECONE_API_KEY) {
    console.warn('[Pinecone] No API key configured. Pinecone sync disabled.');
    return null;
  }
  if (!pc) {
    pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  }
  return pc;
}

function initGemini() {
  if (!GEMINI_API_KEY) {
    console.warn('[Pinecone] No Gemini API key configured. Embedding generation disabled.');
    return null;
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Generate an embedding for the given text using Gemini's embedding model.
 */
async function generateEmbedding(text) {
  const ai = initGemini();
  if (!ai) throw new Error('Gemini API key not configured');
  
  // Use gemini-embedding-001 (3072 dimensions)
  const model = ai.getGenerativeModel({ model: 'models/gemini-embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Query Pinecone for relevant context based on user input.
 */
export async function queryVectors(queryText, topK = 5) {
  const pinecone = initPinecone();
  if (!pinecone) return [];

  const ready = await ensureIndexExists(pinecone);
  if (!ready) return [];

  try {
    const index = pinecone.index(PINECONE_INDEX);
    // Use the global TARGET_DIMENSION

    console.log(`[Pinecone] Querying for: "${queryText.substring(0, 50)}..."`);
    
    let queryValues;
    try {
      queryValues = await generateEmbedding(queryText);
    } catch (e) {
      console.warn('[Pinecone] Query embedding failed, using zero-vector query');
      queryValues = new Array(TARGET_DIMENSION).fill(0.0001);
    }

    // Match dimension
    if (queryValues.length < TARGET_DIMENSION) {
      queryValues = [...queryValues, ...new Array(TARGET_DIMENSION - queryValues.length).fill(0)];
    } else if (queryValues.length > TARGET_DIMENSION) {
      queryValues = queryValues.slice(0, TARGET_DIMENSION);
    }

    const queryResponse = await index.query({
      vector: queryValues,
      topK: topK,
      includeMetadata: true
    });

    return queryResponse.matches || [];
  } catch (error) {
    console.error('[Pinecone] Query failed:', error);
    return [];
  }
}

/**
 * Save an analysis result to Pinecone with embeddings.
 */
export async function saveToPinecone(result) {
  const pinecone = initPinecone();
  if (!pinecone) {
    console.log('[Pinecone] Skipping sync - no API key configured');
    return false;
  }

  // Ensure index exists and is ready before proceeding
  const ready = await ensureIndexExists(pinecone);
  if (!ready) {
    console.error('[Pinecone] Aborting sync - index not ready or could not be created');
    return false;
  }

  try {
    console.log(`[Pinecone] Syncing result for ${result.fileName} to index: ${PINECONE_INDEX}`);
    const index = pinecone.index(PINECONE_INDEX);
    const vectors = [];

    // Using global TARGET_DIMENSION

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      
      const textToEmbed = `
        Product: ${result.product?.productName || result.productName || ''}
        Test: ${row.testName}
        Technique: ${row.technique}
        Rationale: ${row.rationale || ''}
        Composition: ${result.product?.composition || ''}
      `.trim();

      console.log(`[Pinecone] Generating embedding for row ${i+1}/${result.rows.length}: ${row.testName}`);
      let values;
      try {
        values = await generateEmbedding(textToEmbed);
      } catch (e) {
        console.warn(`[Pinecone] Embedding failed, using placeholder vector fallback: ${e.message}`);
        values = new Array(TARGET_DIMENSION).fill(0.0001);
      }

      // Match index dimension (padding or truncating)
      if (values.length < TARGET_DIMENSION) {
        console.log(`[Pinecone] Padding vector from ${values.length} to ${TARGET_DIMENSION}`);
        values = [...values, ...new Array(TARGET_DIMENSION - values.length).fill(0)];
      } else if (values.length > TARGET_DIMENSION) {
        console.log(`[Pinecone] Truncating vector from ${values.length} to ${TARGET_DIMENSION}`);
        values = values.slice(0, TARGET_DIMENSION);
      }

      vectors.push({
        id: `${result.fileId}_${i}`,
        values: values,
        metadata: {
          fileId: result.fileId,
          fileName: result.fileName,
          productName: result.product?.productName || result.productName || '',
          testName: row.testName,
          technique: row.technique,
          t_prep: row.t_prep || 0,
          t_run: row.t_run || 0,
          t_calc: row.t_calc || 0,
          totalTimeHours: row.totalTimeHours || 0,
          timestamp: result.timestamp || Date.now(),
          fullText: (result.fullText || '').substring(0, 30000), // Truncate to avoid metadata limits
          visualContent: (result.visualContent || '').substring(0, 5000),
          images: (result.images || []).join(','),
        }
      });
    }

    if (vectors.length > 0) {
      console.log(`[Pinecone] Upserting ${vectors.length} vectors to ${PINECONE_INDEX}...`);
      await index.upsert({ records: vectors });
      console.log(`[Pinecone] Successfully synced ${result.fileName}`);
    }

    return true;
  } catch (error) {
    console.error('[Pinecone] Sync failed:', error);
    return false;
  }
}
