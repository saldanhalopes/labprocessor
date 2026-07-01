import { AnalysisResult } from '../types';
import { apiFetch } from './api';

export async function saveToPgVector(result: AnalysisResult): Promise<boolean> {
  try {
    console.log(`[PGVector] Syncing ${result.fileName} via backend...`);
    const response = await apiFetch('/pgvector/sync', {
      method: 'POST',
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Sync failed');
    }
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('[PGVector] Sync failed:', error);
    return false;
  }
}
