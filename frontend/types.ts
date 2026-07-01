export type Language = 'pt' | 'es' | 'en';

export interface TranscriptSummary {
  pt: string;
  es: string;
  en: string;
}

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
  transcriptSummary?: TranscriptSummary; // Summarized transcription per language
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

export interface MfvcqInfo {
  matched: boolean;
  codigo_pa?: number;
  celula?: string;
  ativo?: string;
  demanda_media?: number;
  descricao?: string;
}

export interface MfvcqAnalysis {
  celula: string;
  quantidade_lotes: number;
  analises_cq: any[];
  resumo_tempos: {
    tempo_unitario_horas: number;
    fixo_horas: number;
    variavel_por_lote_horas: number;
    tempo_compartilhado_horas: number;
    media_por_lote_horas: number;
    carga_homem_horas: number;
    carga_maquina_horas: number;
    carga_homem_pct: number;
    economia_pct: number;
    carga_homem_mensal_h: number;
    carga_maquina_mensal_h: number;
    tempo_total_mensal_h: number;
  };
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
  mfvcq?: MfvcqInfo;
  mfvcqAnalysis?: MfvcqAnalysis;
  basfluxo?: {
    celula: string;
    quantidade_lotes: number;
    resumo_tempos: any;
    testes: {
      teste: string;
      geminiMatch?: string;
      score?: number;
      source?: string;
      stub?: boolean;
      rota: string;
      fixo: { atividades: number; total_min: number; mo_min: number; maq_min: number };
      variavel: { atividades: number; total_min: number; mo_min: number; maq_min: number };
      total_compartilhado_min: number;
      mo_pct: number;
      atividades?: {
        descricao: string;
        rota: string;
        execucao: string;
        padrao_amostra: string;
        tempo_min: number;
      }[];
    }[];
  };
}

export interface AtividadeBasfluxo {
  atividade: string;
  rota: string;
  execucao: 'MO' | 'MAQ';
  padrao_amostra: 'Padrão' | 'Amostra';
  tempo_corrida_minutos: number;
  similaridade?: string;
  injecoes?: number;
}

export interface EtapaBasfluxo {
  nome: string;
  modo: 'sequencial' | 'paralelo';
  ordem: number;
  atividades: AtividadeBasfluxo[];
}

export interface TesteBasfluxo {
  etapas: EtapaBasfluxo[];
  _meta?: {
    nome?: string;
    aliases?: string[];
  };
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
  pdfUrl?: string; // Path to the original PDF file for download
}

export interface User {
  username: string;
  isAuthenticated: boolean;
  token?: string;
  fullName?: string;
  email?: string;
  company?: string;
  role?: string;
  isAdmin?: boolean;
  plan?: string;
  uploadsToday?: number;
  lastUploadDate?: string;
}
