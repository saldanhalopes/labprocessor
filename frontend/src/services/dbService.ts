/**
 * Frontend service for communicating with the SQLite backend API.
 */
import { AnalysisResult } from '../types';

const API_BASE = '/api';

/**
 * Save an analysis result to the SQLite backend.
 */
export async function saveResultToDb(result: AnalysisResult, token?: string): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[DB] Saving result to database:', result.fileName, 'token:', token ? 'present' : 'missing');

    const response = await fetch(`${API_BASE}/results`, {
      method: 'POST',
      headers,
      body: JSON.stringify(result),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[DB] Save failed with response:', response.status, error);
      throw new Error(error.error || 'Failed to save result to database');
    }
    
    console.log(`[DB] Saved to Firestore: ${result.fileName}`);
  } catch (error) {
    console.error('[DB] Error saving to Firestore:', error);
    throw error;
  }
}

/**
 * Retrieve all results from the SQLite backend.
 */
export async function getResultsFromDb(token?: string): Promise<AnalysisResult[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/results`, { headers });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch results from database');
    }
    
    const results = await response.json();
    console.log(`[DB] Loaded ${results.length} results from SQLite`);
    return results;
  } catch (error) {
    console.error('[DB] Error fetching from SQLite:', error);
    return [];
  }
}

/**
 * Delete a result from the SQLite backend.
 */
export async function deleteResultFromDb(fileId: string, token?: string): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/results/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete result from database');
    }
    
    console.log(`[DB] Deleted from SQLite: ${fileId}`);
  } catch (error) {
    console.error('[DB] Error deleting from SQLite:', error);
    throw error;
  }
}

/**
 * Clear all results from the SQLite backend.
 */
export async function clearDbResults(token?: string): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/results`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to clear database');
    }
    
    console.log('[DB] Database cleared');
  } catch (error) {
    console.error('[DB] Error clearing database:', error);
    throw error;
  }
}

/**
 * Check if a file has already been processed in the backend.
 */
export async function checkFileExists(fileName: string, token?: string): Promise<{ exists: boolean; fileId: string | null }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/results/exists?fileName=${encodeURIComponent(fileName)}`, { headers });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to check file existence');
    }
    
    return await response.json();
  } catch (error) {
    console.error('[DB] Error checking file existence:', error);
    return { exists: false, fileId: null };
  }
}

/**
 * Update an existing result in the backend.
 */
export async function updateResultInDb(fileId: string, result: AnalysisResult, token?: string): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/results/${encodeURIComponent(fileId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(result),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update result');
    }
    
    console.log(`[DB] Updated in database: ${fileId}`);
  } catch (error) {
    console.error('[DB] Error updating in database:', error);
    throw error;
  }
}
