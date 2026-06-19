import { AnalysisResult } from '../types';
import { apiFetch } from './api';

export async function saveResultToDb(result: AnalysisResult): Promise<void> {
  try {
    const response = await apiFetch('/results', {
      method: 'POST',
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save result to database');
    }
    console.log(`[DB] Saved: ${result.fileName}`);
  } catch (error) {
    console.error('[DB] Error saving:', error);
    throw error;
  }
}

export async function getResultsFromDb(): Promise<AnalysisResult[]> {
  try {
    const response = await apiFetch('/results');
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch results');
    }
    const results = await response.json();
    console.log(`[DB] Loaded ${results.length} results`);
    return results;
  } catch (error) {
    console.error('[DB] Error fetching:', error);
    return [];
  }
}

export async function deleteResultFromDb(fileId: string): Promise<void> {
  try {
    const response = await apiFetch(`/results/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete result');
    }
    console.log(`[DB] Deleted: ${fileId}`);
  } catch (error) {
    console.error('[DB] Error deleting:', error);
    throw error;
  }
}

export async function clearDbResults(): Promise<void> {
  try {
    const response = await apiFetch('/results', { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clear database');
    }
    console.log('[DB] Database cleared');
  } catch (error) {
    console.error('[DB] Error clearing:', error);
    throw error;
  }
}

export async function checkFileExists(fileName: string): Promise<{ exists: boolean; fileId: string | null }> {
  try {
    const response = await apiFetch(`/results/exists?fileName=${encodeURIComponent(fileName)}`);
    if (!response.ok) return { exists: false, fileId: null };
    return await response.json();
  } catch (error) {
    console.error('[DB] Error checking file:', error);
    return { exists: false, fileId: null };
  }
}

export async function updateResultInDb(fileId: string, result: AnalysisResult): Promise<void> {
  try {
    const response = await apiFetch(`/results/${encodeURIComponent(fileId)}`, {
      method: 'PUT',
      body: JSON.stringify(result),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update result');
    }
    console.log(`[DB] Updated: ${fileId}`);
  } catch (error) {
    console.error('[DB] Error updating:', error);
    throw error;
  }
}
