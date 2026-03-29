import { AnalysisRow, GlobalSettings, AnalysisResult } from '../types';

export const DEFAULT_SETTINGS: GlobalSettings = {
  area: 1160,
  velocity: 60,
  alpha: 4,
  setupFactor: 5, 
  registerFactor: 0.5,
  labEfficiency: 0.75,
  factorRun: 0.10,
  factorIncubation: 0.02,
  dailyAvailableMinutes: 528
};

export const isMicrobiology = (row: AnalysisRow): boolean => {
  const keywords = [
    'micro', 'bioburden', 'sterility', 'esterilidade', 'bacteri', 'fung', 'yeast', 
    'mold', 'levedura', 'bolor', 'usp 61', 'usp 62', 'tamc', 'tymc', 'endotoxin', 'lal', 'pathogen'
  ];
  const textToCheck = `${row.technique} ${row.category} ${row.testName}`.toLowerCase();
  return keywords.some(k => textToCheck.includes(k));
};

export const calculateLocomotion = (settings: GlobalSettings): number => {
  return (settings.alpha * Math.sqrt(settings.area)) / settings.velocity;
};

export const recalculateRow = (row: AnalysisRow, settings: GlobalSettings): AnalysisRow => {
  const t_locomotion = calculateLocomotion(settings);
  const t_setup = settings.setupFactor; 
  const t_register = row.t_calc * settings.registerFactor;
  const isMicro = isMicrobiology(row);
  const effectiveIncubation = isMicro ? (row.t_incubation || 0) : 0;

  const totalMinutes = 
    t_locomotion + 
    t_setup + 
    row.t_prep + 
    row.t_analysis + 
    row.t_run + 
    row.t_calc + 
    t_register +
    effectiveIncubation;

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

export const calculateTotalManHours = (rows: AnalysisRow[]): number => {
  if (!rows || rows.length === 0) return 0;
  return rows.reduce((acc, row) => acc + (row.manHours || 0), 0);
};

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
    "Arquivo", "Produto", "Teste", "Categoria", "Técnica", "Detalhes",
    "Preparo (min)", "Corrida (min)", "Cálculos (min)", "Incubação (min)",
    "Locomoção (min)", "Setup (min)", "Registro (min)", "Lead Time (h)",
    "Hora-Homem (HH)", "Esforço Ativo (%)", "Racional"
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
