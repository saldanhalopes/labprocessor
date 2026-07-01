/**
 * mem0 Memory Client — wraps self-hosted mem0 REST API
 * Provides: remember(), recall(), forget()
 * Used by LabProcessor to persist context across sessions.
 */
const MEM0_URL = process.env.MEM0_API_URL || 'http://192.168.15.59:8888';
const MEM0_KEY = process.env.MEM0_API_KEY || 'm0sk_42eVsnRK8B07oL19u6c5iZZqS2ldDl9bqBtotpGyY0s';
const USER_ID = process.env.MEM0_USER_ID || 'labprocessor';

async function mem0(method, path, body) {
  const url = `${MEM0_URL}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-API-Key': MEM0_KEY }
  };
  if (body) opts.body = JSON.stringify(body);

  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        if (res.status === 404) return null;
        throw new Error(`mem0 ${res.status}: ${err}`);
      }
      return await res.json();
    } catch (e) {
      if (i === 1) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

/**
 * Store a memory.
 * @param {string|object} content — text to remember, or object with { type, ...metadata }
 * @param {string} [userId] — user identifier
 * @returns {Promise<string[]>} extracted memory strings
 */
export async function remember(content, userId = USER_ID) {
  try {
    const payload = typeof content === 'object'
      ? JSON.stringify(content)
      : content;
    const r = await mem0('POST', '/memories', {
      messages: [{ role: 'user', content: payload }],
      user_id: userId
    });
    return (r.results || []).map(m => m.memory);
  } catch (e) {
    console.error('[mem0] remember error:', e.message);
    return [];
  }
}

/**
 * Search memories.
 * @param {string} query — search query
 * @param {string} [userId] — user identifier
 * @returns {Promise<Array<{id:string, memory:string}>>}
 */
export async function recall(query, userId = USER_ID) {
  try {
    const r = await mem0('POST', '/search', { query, user_id: userId });
    return (r.results || []).map(m => ({ id: m.id, memory: m.memory }));
  } catch (e) {
    console.error('[mem0] recall error:', e.message);
    return [];
  }
}

/**
 * Get recent memories.
 * @param {string} [userId]
 * @param {number} [limit=10]
 */
export async function recent(userId = USER_ID, limit = 10) {
  try {
    const r = await mem0('GET', `/memories?user_id=${userId}&limit=${limit}`);
    const list = Array.isArray(r) ? r : (r?.results || []);
    return list.map(m => ({ id: m.id, memory: m.memory, created_at: m.created_at }));
  } catch (e) {
    console.error('[mem0] recent error:', e.message);
    return [];
  }
}

/**
 * Delete a memory by ID.
 */
export async function forget(memoryId) {
  try {
    await mem0('DELETE', `/memories/${memoryId}`);
    return true;
  } catch (e) {
    console.error('[mem0] forget error:', e.message);
    return false;
  }
}

export default { remember, recall, recent, forget };
