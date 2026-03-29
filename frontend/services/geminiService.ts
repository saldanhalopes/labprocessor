/**
 * Frontend Gemini analysis service - proxies through the backend to avoid
 * browser compatibility issues and secure the API key.
 */
import { AnalysisResult, AnalysisRow, GlobalSettings, Reagent } from '../types';
import { recalculateRow, DEFAULT_SETTINGS, isMicrobiology } from '../utils/calculations';

const API_BASE = '/api';

/**
 * Proxies the document analysis to the backend.
 */
export const analyzeDocument = async (
  base64Data: string, 
  mimeType: string, 
  fileName: string,
  settings: GlobalSettings = DEFAULT_SETTINGS,
  language: string = 'pt',
  images: string[] = [],
  token?: string
): Promise<AnalysisResult> => {
  try {
    console.log(`[Gemini-Proxy] Sending ${fileName} to backend for analysis...`);
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base64Data, mimeType, fileName, language, images }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Document analysis failed');
    }

    const rawData = await response.json();
    console.log("[Gemini-Proxy] Data received from backend:", rawData);

    // Validate rows array exists
    if (!rawData.rows || !Array.isArray(rawData.rows)) {
      rawData.rows = [];
    }

    // Process rows with the calculation formula (performed on frontend to respect current settings)
    const processedRows: AnalysisRow[] = rawData.rows.map((row: any) => {
      const baseRow: AnalysisRow = {
        id: row.id || Math.floor(Math.random() * 10000),
        testName: row.testName || "Teste sem nome",
        technique: row.technique || "Geral",
        category: row.category || 'Geral',
        details: row.details || "",
        t_prep: Number(row.t_prep) || 0,
        t_analysis: Number(row.t_analysis) || 0,
        t_run: Number(row.t_run) || 0,
        t_calc: Number(row.t_calc) || 0,
        t_incubation: Number(row.t_incubation) || 0,
        t_locomotion: 0, 
        t_setup: 0,      
        t_register: 0,   
        totalTimeHours: 0, 
        manHours: 0,
        rationale: row.rationale || ""
      };
      return recalculateRow(baseRow, settings);
    });

    // Process reagents
    const processedReagents: Reagent[] = Array.isArray(rawData.reagents) 
      ? rawData.reagents.map((r: any) => ({
          name: r.name || "Desconhecido",
          quantity: r.quantity || "-",
          concentration: r.concentration || "-",
          category: r.category || "Geral",
          testName: r.testName || ""
        }))
      : [];

    // Calculate separated totals
    let totalTimePhysChem = 0;
    let totalTimeMicro = 0;

    processedRows.forEach(row => {
      if (isMicrobiology(row)) {
        totalTimeMicro += row.totalTimeHours;
      } else {
        totalTimePhysChem += row.totalTimeHours;
      }
    });

    const totalTime = totalTimePhysChem + totalTimeMicro;

    return {
      fileId: Date.now().toString() + Math.random().toString(),
      fileName,
      product: {
        productName: rawData.product?.productName || "Produto Desconhecido",
        code: rawData.product?.code || "",
        pharmaceuticalForm: rawData.product?.pharmaceuticalForm || "",
        activePrinciples: rawData.product?.activePrinciples || "",
        composition: rawData.product?.composition || "",
        batchSize: rawData.product?.batchSize || ""
      },
      rows: processedRows,
      reagents: processedReagents,
      equipments: rawData.equipments || [],
      standards: rawData.standards || [],
      fullText: rawData.fullText || "",
      visualContent: rawData.visualContent || "",
      images: rawData.images || [],
      totalTime,
      totalTimePhysChem,
      totalTimeMicro,
      timestamp: Date.now()
    };

  } catch (error) {
    console.error("[Gemini-Proxy] Error analyzing document:", error);
    throw error;
  }
};

/**
 * Frontend placeholder for generateEmbedding.
 * Embedding generation is now handled server-side for Pinecone sync.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  console.warn("[Gemini-Proxy] generateEmbedding called on frontend. This is deprecated as embedding is handled server-side.");
  return [];
}
