import { getAllResults, getBatches, getCapacitiesInRange } from './firestore.js';

// Calculate variability factor based on historical completed batches
function calculateVariabilityFactor(historicBatches) {
  if (!historicBatches || historicBatches.length === 0) return 1.1; // Default 10% buffer if no history
  
  let totalRatio = 0;
  let count = 0;
  
  // Consider at most the last 20 completed batches for better stability
  const recent = historicBatches.slice(0, 20);
  for (const b of recent) {
     if (b.realTime && b.theoreticalTime) {
         totalRatio += (b.realTime / b.theoreticalTime);
         count++;
     }
  }
  
  const factor = count > 0 ? (totalRatio / count) : 1.1;
  // Cap variability to avoid extreme predictions
  return Math.min(Math.max(factor, 0.8), 2.0);
}

// Comprehensive Microbiology identification (Sync with frontend/utils/calculations.ts)
function isMicrobiology(row) {
  const keywords = [
    'micro', 'bioburden', 'sterility', 'esterilidade', 'bacteri', 'fung', 'yeast', 
    'mold', 'levedura', 'bolor', 'usp 61', 'usp 62', 'tamc', 'tymc', 'endotoxin', 'lal', 'pathogen'
  ];
  const textToCheck = `${row.technique || ''} ${row.category || ''} ${row.testName || ''} ${row.methodName || ''} ${row.area || ''}`.toLowerCase();
  return keywords.some(k => textToCheck.includes(k));
}

// Helper to add days to a date string (YYYY-MM-DD)
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Find if a date is weekend
function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Main prediction engine function.
 * 1. Fetches active batches and sorts by Priority (Low=3, Med=2, High=1) then FIFO (EntryDate).
 * 2. Fetches lab capacity for the next 30 days.
 * 3. Consumes capacity day by day for each batch.
 * 4. Outputs ETD, Status, and Bottlenecks.
 */
export async function calculatePrediction(userSettings = null) {
  // Use provided settings or fall back to high-accuracy defaults
  const settings = userSettings || {
    labEfficiency: 0.75,
    dailyAvailableMinutes: 528
  };

  const allBatches = await getBatches();
  
  // Filter only pending/active batches
  const activeBatches = allBatches.filter(b => b.status !== 'completed');
  const historicBatches = allBatches.filter(b => b.status === 'completed');

  // Sort batches: Priority First (1 is highest), then FIFO (Entry Date ascending)
  activeBatches.sort((a, b) => {
     const prioA = a.priority || 3;
     const prioB = b.priority || 3;
     if (prioA !== prioB) return prioA - prioB;
     return new Date(a.entryDate || 0).getTime() - new Date(b.entryDate || 0).getTime();
  });

  const productsDb = await getAllResults();
  const productTimesMap = {};
  productsDb.forEach(res => {
     let fqHours = 0;
     let microHours = 0;
     (res.rows || []).forEach(row => {
        if (isMicrobiology(row)) microHours += (row.manHours || 0);
        else fqHours += (row.manHours || 0);
     });
     productTimesMap[res.productId || res.productName || res.fileId] = {
         fq: fqHours || 0,
         micro: microHours || 0,
         total: fqHours + microHours
     };
  });

  const globalVarFactor = calculateVariabilityFactor(historicBatches);
  const todayStr = new Date().toISOString().split('T')[0];
  const endDayStr = addDays(todayStr, 90); // Extended horizon to 90 days
  const rawCapacities = await getCapacitiesInRange(todayStr, endDayStr);
  const capacityMap = {};
  rawCapacities.forEach(c => { capacityMap[c.date] = c; });

  let dailyUsage = {}; 
  
  const results = activeBatches.map(batch => {
      const productTime = productTimesMap[batch.productId] || { fq: 0, micro: 0, total: 0 };
      
      if (productTime.total === 0) {
         return {
            ...batch,
            predictedDate: batch.limitDate || todayStr,
            riskStatus: 'Verde',
            identifiedBottleneck: 'Sem dados teóricos para este produto',
            theoreticalHH: 0
         };
      }

      let remainingFQ = productTime.fq * globalVarFactor;
      let remainingMicro = productTime.micro * globalVarFactor;
      
      let currentDateStr = todayStr;
      let bottleneck = null;

      while ((remainingFQ > 0 || remainingMicro > 0) && currentDateStr <= endDayStr) {
          if (!dailyUsage[currentDateStr]) {
              dailyUsage[currentDateStr] = { fqUsed: 0, microUsed: 0 };
          }
          
          let cap = capacityMap[currentDateStr];
          
          // Default capacity logic: Convert Analysts count to Available Hours
          // Formula: (analysts * dailyMinutes * efficiency) / 60
          const convertToHours = (analystCount) => (analystCount * settings.dailyAvailableMinutes * settings.labEfficiency) / 60;

          const rawAnalystsFQ = cap ? (cap.analystsFQ || 0) : (isWeekend(currentDateStr) ? 0 : 8);
          const rawAnalystsMicro = cap ? (cap.analystsMicro || 0) : (isWeekend(currentDateStr) ? 0 : 8);
          
          const maxHoursFQ = convertToHours(rawAnalystsFQ);
          const maxHoursMicro = convertToHours(rawAnalystsMicro);

          const dailyAvailFQ = maxHoursFQ - dailyUsage[currentDateStr].fqUsed;
          if (remainingFQ > 0) {
              if (dailyAvailFQ > 0) {
                 const consume = Math.min(remainingFQ, dailyAvailFQ);
                 remainingFQ -= consume;
                 dailyUsage[currentDateStr].fqUsed += consume;
              } else {
                 bottleneck = `Gargalo: Capacidade Fístíco-Química saturada (${rawAnalystsFQ} analistas)`;
              }
          }

          const dailyAvailMicro = maxHoursMicro - dailyUsage[currentDateStr].microUsed;
          if (remainingMicro > 0) {
              if (dailyAvailMicro > 0) {
                 const consume = Math.min(remainingMicro, dailyAvailMicro);
                 remainingMicro -= consume;
                 dailyUsage[currentDateStr].microUsed += consume;
              } else {
                 bottleneck = `Gargalo: Capacidade Micro saturada (${rawAnalystsMicro} analistas)`;
              }
          }

          if (cap && cap.equipmentStatus === 'maintenance') {
              bottleneck = "Equipamento em Manutenção";
              // Rollback today's effort for this batch if bottleneck identified
              remainingFQ += (maxHoursFQ - dailyAvailFQ); 
              remainingMicro += (maxHoursMicro - dailyAvailMicro);
          }

          if (remainingFQ > 0 || remainingMicro > 0) {
              currentDateStr = addDays(currentDateStr, 1);
          }
      }

      const predictedDate = currentDateStr;
      let riskStatus = 'Verde';
      if (batch.limitDate) {
          const limitTime = new Date(batch.limitDate + 'T12:00:00Z').getTime();
          const predictedTime = new Date(predictedDate + 'T12:00:00Z').getTime();
          const diffDays = (limitTime - predictedTime) / (1000 * 3600 * 24);
          
          if (diffDays < 0) riskStatus = 'Vermelho';
          else if (diffDays <= 2) riskStatus = 'Amarelo';
      }

      return {
          ...batch,
          predictedDate,
          riskStatus,
          identifiedBottleneck: bottleneck || "Nenhum",
          theoreticalHH: productTime.total.toFixed(2),
          variabilityFactor: globalVarFactor.toFixed(2)
      };
  });

  return results;
}
