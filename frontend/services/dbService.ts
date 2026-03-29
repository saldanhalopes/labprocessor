/**
 * Frontend service for communicating with the SQLite backend API.
 */
import { AnalysisResult } from '../types';

const API_BASE = '/api';

/**
 * Save an analysis result to the SQLite backend.
 */
export async function saveResultToDb(result: AnalysisResult): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save result to database');
    }
    
    console.log(`[DB] Saved to SQLite: ${result.fileName}`);
  } catch (error) {
    console.error('[DB] Error saving to SQLite:', error);
    throw error;
  }
}

/**
 * Retrieve all results from the SQLite backend.
 */
export async function getResultsFromDb(): Promise<AnalysisResult[]> {
  try {
    const response = await fetch(`${API_BASE}/results`);
    
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
export async function deleteResultFromDb(fileId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/results/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
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
export async function clearDbResults(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/results`, {
      method: 'DELETE',
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
export async function checkFileExists(fileName: string): Promise<{ exists: boolean; fileId: string | null }> {
  try {
    const response = await fetch(`${API_BASE}/results/exists?fileName=${encodeURIComponent(fileName)}`);
    
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
export async function updateResultInDb(fileId: string, result: AnalysisResult): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/results/${encodeURIComponent(fileId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
