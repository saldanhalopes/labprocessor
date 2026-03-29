/**
 * Frontend Pinecone service - proxies through the backend to avoid
 * browser compatibility issues with the Pinecone SDK.
 */
import { AnalysisResult } from '../types';

const API_BASE = '/api';

/**
 * Sync an analysis result to Pinecone via the backend.
 */
export async function saveToPinecone(result: AnalysisResult): Promise<boolean> {
  try {
    console.log(`[Pinecone] Syncing ${result.fileName} via backend...`);
    const response = await fetch(`${API_BASE}/pinecone/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Pinecone sync failed');
    }

    const data = await response.json();
    console.log(`[Pinecone] Sync result:`, data.success);
    return data.success;
  } catch (error) {
    console.error('[Pinecone] Sync via backend failed:', error);
    return false;
  }
}
