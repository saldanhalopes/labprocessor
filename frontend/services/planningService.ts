import { CapacityData, BatchData, PredictionResult, GlobalSettings } from '../types';

const API_BACKEND_PORT = import.meta.env.VITE_API_BACKEND_PORT || 8080;
const API_BACKEND_HOST = import.meta.env.VITE_API_BACKEND_HOST || "localhost";
const BASE_URL = `http://${API_BACKEND_HOST}:${API_BACKEND_PORT}/api`;

const getHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
});

export const saveCapacity = async (capacityData: CapacityData, token?: string): Promise<CapacityData> => {
  const response = await fetch(`${BASE_URL}/capacity`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(capacityData),
  });
  if (!response.ok) throw new Error('Failed to save capacity');
  return response.json();
};

export const getCapacity = async (date: string, token?: string): Promise<CapacityData> => {
  const response = await fetch(`${BASE_URL}/capacity/${date}`, {
    method: 'GET',
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch capacity');
  return response.json();
};

export const getCapacitiesInRange = async (start: string, end: string, token?: string): Promise<CapacityData[]> => {
  const response = await fetch(`${BASE_URL}/capacity/range?start=${start}&end=${end}`, {
    method: 'GET',
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch capacity range');
  return response.json();
};

export const saveBatch = async (batchData: BatchData, token?: string): Promise<BatchData> => {
  const response = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(batchData),
  });
  if (!response.ok) throw new Error('Failed to save batch');
  return response.json();
};

export const getBatches = async (token?: string): Promise<BatchData[]> => {
  const response = await fetch(`${BASE_URL}/batches`, {
    method: 'GET',
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to fetch batches');
  return response.json();
};

export const deleteBatch = async (id: string, token?: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/batches/${id}`, {
    method: 'DELETE',
    headers: getHeaders(token),
  });
  if (!response.ok) throw new Error('Failed to delete batch');
};

export const runPrediction = async (settings: GlobalSettings, token?: string): Promise<PredictionResult[]> => {
  const response = await fetch(`${BASE_URL}/predict`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(settings)
  });
  if (!response.ok) throw new Error('Failed to run prediction');
  return response.json();
};
