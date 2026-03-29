export type Language = 'pt' | 'es' | 'en';

export interface AnalysisRow {
  id: number | string;
  testName: string;
  technique: string;
  category: string;
  details: string;
  t_prep: number;
  t_analysis: number;
  t_run: number;
  t_calc: number;
  t_incubation: number;
  t_locomotion: number;
  t_setup: number;
  t_register: number;
  totalTimeHours: number;
  manHours: number;
  estimatedTime?: number;
  rationale: string;
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
  category: string;
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
  pharmaceuticalForm?: string;
  activePrinciples?: string;
  composition?: string;
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
  totalTimePhysChem: number;
  totalTimeMicro: number;
  fullText?: string;
  visualContent?: string;
  images?: string[];
  timestamp: number;
  pdfUrl?: string; // Replicated from source
}

export interface GlobalSettings {
  area: number;
  velocity: number;
  alpha: number;
  setupFactor: number;
  registerFactor: number;
  labEfficiency: number;
  factorRun: number;
  factorIncubation: number;
  dailyAvailableMinutes: number;
}

export interface HistoryItem {
  id: string;
  date: string;
  fileName: string;
  productName: string;
  totalTime: number;
  workloadTime?: number;
  manHours?: number;
  totalTimePhysChem: number;
  totalTimeMicro: number;
  pdfUrl?: string;
}

export interface User {
  username: string;
  uid?: string;
  token?: string;
  password?: string;
  isAuthenticated: boolean;
  fullName?: string;
  email?: string;
  company?: string;
  role?: string;
  isAdmin?: boolean;
  subscriptionStatus: 'active' | 'inactive';
  plan?: 'free' | 'basic' | 'pro';
  uploadsToday?: number;
  lastUploadDate?: string;
}
