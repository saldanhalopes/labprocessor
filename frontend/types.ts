export type Language = 'pt' | 'es' | 'en';

export interface AnalysisRow {
  id: number | string;
  testName: string;
  technique: string; // e.g., HPLC, Dissolution, Visual
  category: string; // e.g., Release, Stability
  details: string; // Raw text details
  
  // Time components (in minutes)
  t_prep: number;
  t_analysis: number;
  t_run: number;
  t_calc: number;
  t_incubation: number; // New field for incubation time
  
  // Calculated fields
  t_locomotion: number;
  t_setup: number;
  t_register: number;
  totalTimeHours: number; // Final result in hours
  manHours: number; // Active human effort in hours
  
  rationale: string; // Explanation of the calculation
}

export interface Reagent {
  name: string;
  quantity: string;
  concentration: string;
  category: string;
  testName?: string;
}

export interface Equipment {
  name: string;
  model: string;
  category: string; // e.g., Chromatograph, Balance, Dissoluter, Spectrophotometer
  testName?: string;
}

export interface Standard {
  name: string;
  amountmg: string;
  concentration: string;
  testName?: string;
}

export interface ProductData {
  productName: string;
  batchSize?: string;
  code?: string;
  pharmaceuticalForm?: string; // e.g., Comprimido, Xarope
  activePrinciples?: string; // e.g., Paracetamol, Cafeína
  composition?: string; // Resumo da composição
}

export interface AnalysisResult {
  fileId: string;
  fileName: string;
  product: ProductData;
  rows: AnalysisRow[];
  reagents: Reagent[];
  equipments: Equipment[];
  standards: Standard[];
  totalTime: number;
  totalTimePhysChem: number; // Total time for Physico-chemical tests
  totalTimeMicro: number;    // Total time for Microbiological tests
  fullText?: string;         // Full transcribed text of the document
  visualContent?: string;    // Description of images/tables
  images?: string[];         // Filenames of extracted images
  timestamp: number;
}

export interface GlobalSettings {
  area: number; // m² (default 1160)
  velocity: number; // m/min (default 60)
  alpha: number; // trechos (default 4)
  setupFactor: number; // multiplier (default 5)
  registerFactor: number; // multiplier of calc time (default 0.5)
  // Management Params (HH)
  labEfficiency: number; // e.g. 0.75
  factorRun: number; // e.g. 0.10
  factorIncubation: number; // e.g. 0.02
  dailyAvailableMinutes: number; // e.g. 528
}

export interface HistoryItem {
  id: string;
  date: string;
  fileName: string;
  productName: string;
  totalTime: number; // This will now represent Lead Time (Parallel)
  workloadTime?: number; // Total Sum (Sequential) Load
  manHours?: number; // Total Active Human Effort
  totalTimePhysChem: number;
  totalTimeMicro: number;
}

export interface User {
  username: string;
  password?: string; // Optional for display, required for storage
  isAuthenticated: boolean;
  fullName?: string;
  email?: string;
  company?: string;
  role?: string;
  isAdmin?: boolean; // New flag for admin privileges
  subscriptionStatus: 'active' | 'inactive'; // New field for subscription
  plan?: 'free' | 'basic' | 'pro'; // Subscription plan
  uploadsToday?: number; // Count of uploads made today
  lastUploadDate?: string; // Date string (YYYY-MM-DD) of last upload
}
