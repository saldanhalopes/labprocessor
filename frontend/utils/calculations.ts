import { AnalysisRow, GlobalSettings, AnalysisResult } from '../types';

export const DEFAULT_SETTINGS: GlobalSettings = {
  area: 1160,
  velocity: 60,
  alpha: 4,
  setupFactor: 5, // 5x unit time (assuming unit time is ~1-2 min for setup actions, or just a factor)
  registerFactor: 0.5,
  labEfficiency: 0.75,
  factorRun: 0.10,
  factorIncubation: 0.02,
  dailyAvailableMinutes: 528
};

// Helper to determine if a test is microbiological based on technique or category
export const isMicrobiology = (row: AnalysisRow): boolean => {
  const keywords = [
    'micro', 'bioburden', 'sterility', 'esterilidade', 'bacteri', 'fung', 'yeast', 
    'mold', 'levedura', 'bolor', 'usp 61', 'usp 62', 'tamc', 'tymc', 'endotoxin', 'lal', 'pathogen'
  ];
  const textToCheck = `${row.technique} ${row.category} ${row.testName}`.toLowerCase();
  return keywords.some(k => textToCheck.includes(k));
};

// Calculate Locomotion time in minutes
export const calculateLocomotion = (settings: GlobalSettings): number => {
  // Formula: (ALPHA * √AREA) / VELOCIDAD
  return (settings.alpha * Math.sqrt(settings.area)) / settings.velocity;
};

// Recalculate a single row based on current settings
export const recalculateRow = (row: AnalysisRow, settings: GlobalSettings): AnalysisRow => {
  const t_locomotion = calculateLocomotion(settings);
  
  // Heuristic: Setup is often fixed or proportional. 
  const t_setup = settings.setupFactor; 

  const t_register = row.t_calc * settings.registerFactor;

  // Determine if incubation should be included
  const isMicro = isMicrobiology(row);
  const effectiveIncubation = isMicro ? (row.t_incubation || 0) : 0;

  // Total in Minutes (Lead Time)
  const totalMinutes = 
    t_locomotion + 
    t_setup + 
    row.t_prep + 
    row.t_analysis + 
    row.t_run + 
    row.t_calc + 
    t_register +
    effectiveIncubation;

  // Active Human Effort (Man-Hours) in Minutes
  // Logic: 100% of locomotion, setup, prep, analysis, calc, register.
  // Factored: run and incubation using dynamic settings
  const activeEffortMinutes = 
    t_locomotion + 
    t_setup + 
    row.t_prep + 
    row.t_analysis + 
    (row.t_run * (settings.factorRun ?? 0.10)) + 
    row.t_calc + 
    t_register +
    (effectiveIncubation * (settings.factorIncubation ?? 0.02));

  return {
    ...row,
    t_locomotion,
    t_setup,
    t_register,
    totalTimeHours: totalMinutes / 60,
    manHours: activeEffortMinutes / 60
  };
};

/**
 * Calculates the total Man-Hours for a set of analysis rows.
 */
export const calculateTotalManHours = (rows: AnalysisRow[]): number => {
  if (!rows || rows.length === 0) return 0;
  return rows.reduce((acc, row) => acc + (row.manHours || 0), 0);
};

/**
 * Calculates how many analysts are required based on total man-hours.
 * Formula: (totalManHours * 60) / (DAILY_AVAILABLE_MINUTES * LAB_EFFICIENCY)
 */
export const calculateStaffRequired = (totalManHours: number, settings: GlobalSettings): number => {
  if (totalManHours <= 0) return 0;
  const efficiency = settings.labEfficiency ?? 0.75;
  const availableMinutes = settings.dailyAvailableMinutes ?? 528;
  return (totalManHours * 60) / (availableMinutes * efficiency);
};

export const calculateParallelLeadTime = (rows: AnalysisRow[]): number => {
  if (!rows || rows.length === 0) return 0;
  
  const physChemRows = rows.filter(row => !isMicrobiology(row));
  const microRows = rows.filter(row => isMicrobiology(row));
  
  const maxPhysChem = physChemRows.length > 0 
    ? Math.max(...physChemRows.map(r => r.totalTimeHours || 0)) 
    : 0;
    
  const maxMicro = microRows.length > 0 
    ? Math.max(...microRows.map(r => r.totalTimeHours || 0)) 
    : 0;
    
  return Math.max(maxPhysChem, maxMicro);
};

export const generateCSV = (results: AnalysisResult[]): string => {
  const headers = [
    "Arquivo",
    "Produto",
    "Teste",
    "Categoria",
    "Técnica",
    "Detalhes",
    "Preparo (min)",
    "Corrida (min)",
    "Cálculos (min)",
    "Incubação (min)",
    "Locomoção (min)",
    "Setup (min)",
    "Registro (min)",
    "Lead Time (h)",
    "Hora-Homem (HH)",
    "Esforço Ativo (%)",
    "Racional"
  ];

  const rows = results.flatMap(res => 
    res.rows.map(row => {
      const isMicro = isMicrobiology(row);
      const incubationDisplay = isMicro ? (row.t_incubation || 0).toFixed(2) : "0.00 (N/A)";
      const rowHH = row.manHours || 0;
      const rowLeadTime = row.totalTimeHours || 0;
      const activeEffortPct = rowLeadTime > 0 ? (rowHH / rowLeadTime) * 100 : 0;
      
      return [
        `"${res.fileName}"`,
        `"${res.product.productName}"`,
        `"${row.testName}"`,
        `"${isMicro ? 'Microbiologia' : 'Físico-Químico'}"`,
        `"${row.technique}"`,
        `"${row.details}"`,
        row.t_prep.toFixed(2),
        row.t_run.toFixed(2),
        row.t_calc.toFixed(2),
        incubationDisplay,
        row.t_locomotion.toFixed(2),
        row.t_setup.toFixed(2),
        row.t_register.toFixed(2),
        rowLeadTime.toFixed(2),
        rowHH.toFixed(2),
        activeEffortPct.toFixed(1) + "%",
        `"${row.rationale}"`
      ].join(",");
    })
  );

  return [headers.join(","), ...rows].join("\n");
};
