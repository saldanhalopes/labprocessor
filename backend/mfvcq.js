import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadVault, findSimilar, createStub, expandAlias } from './knowledge.js';

function loadTestConfig() {
  try {
    if (fs.existsSync(TEST_CONFIG_PATH)) return JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf-8'));
  } catch(e) {}
  return {};
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REFS_DIR = path.join(__dirname, 'reference');
const TEST_CONFIG_PATH = path.join(__dirname, 'config', 'tests.json');

function loadData() {
  return {
    basefluxo: JSON.parse(fs.readFileSync(path.join(REFS_DIR, 'basefluxo_estruturado.json'), 'utf-8')),
    demanda: JSON.parse(fs.readFileSync(path.join(REFS_DIR, 'demanda_estruturada.json'), 'utf-8')),
    indices: JSON.parse(fs.readFileSync(path.join(REFS_DIR, 'indices_busca.json'), 'utf-8')),
    externalCodes: loadExternalCodes()
  };
}

function loadExternalCodes() {
  const p = path.join(REFS_DIR, 'external_codes.json');
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) { console.error('[MFVCQ] Error loading external codes:', e.message); }
  return {};
}

function lookupByExternalCode(code) {
  if (!code) return null;
  const ec = loadExternalCodes();
  const q = String(code).trim().toUpperCase();

  // Exact key match
  if (ec[q]) return { ...ec[q], matched_key: q };

  // Exact registro_anvisa match
  const byRegistro = Object.entries(ec).find(([, v]) => String(v.registro_anvisa || '').toUpperCase() === q);
  if (byRegistro) return { ...byRegistro[1], matched_key: byRegistro[0] };

  // Partial match on keys and registro_anvisa
  const byPartial = Object.entries(ec).find(([k, v]) =>
    String(k).toUpperCase().includes(q) ||
    String(v.registro_anvisa || '').toUpperCase().includes(q)
  );
  if (byPartial) return { ...byPartial[1], matched_key: byPartial[0] };

  return null;
}

function inferFormFromDescription(descricao) {
  if (!descricao) return null;
  const d = descricao.toUpperCase();
  if (d.includes('COMP') || d.includes('CPR') || d.includes('CAP') || d.includes('DRG') || d.includes('GRAGEA') || d.includes('TABLETA')) return 'Sólidos';
  if (d.includes('INJ') || d.includes('SOL') || d.includes('AMP')) return 'Injetáveis';
  if (d.includes('SUS') || d.includes('XAR') || d.includes('ELI')) return 'Suspensões/Líquidos';
  if (d.includes('CR') || d.includes('POM') || d.includes('GEL')) return 'Cremes/Pomadas';
  return null;
}

function inferFormFromPharmForm(pharmForm) {
  if (!pharmForm) return null;
  const f = pharmForm.toLowerCase();
  if (f.includes('comprimido') || f.includes('tableta') || f.includes('cápsula') || f.includes('capsula') || f.includes('drágea') || f.includes('gragea')) return 'Sólidos';
  if (f.includes('injetável') || f.includes('inj')) return 'Injetáveis';
  if (f.includes('suspensão') || f.includes('suspension') || f.includes('xarope') || f.includes('jarabe') || f.includes('solução') || f.includes('solucion') || f.includes('gotas') || f.includes('elixir')) return 'Suspensões/Líquidos';
  if (f.includes('creme') || f.includes('pomada') || f.includes('gel') || f.includes('unguento')) return 'Cremes/Pomadas';
  if (f.includes('matéria-prima') || f.includes('materia-prima') || f.includes('polvo') || f.includes('pó') || f.includes('granulado') || f.includes('api')) return 'Sólidos';
  return null;
}

function determineCell(form) {
  if (!form) return 'DESCONHECIDA';
  const f = form.toLowerCase();
  if (f.includes('sólido') || f.includes('solido')) return 'SÓLIDOS 1';
  if (f.includes('líquido') || f.includes('liquido') || f.includes('susp')) return 'SUSP/LIQ/CR/POM I, II e III';
  if (f.includes('inj') || f.includes('onc')) return 'INJETÁVEIS e ONCOLÓGICOS';
  if (f.includes('creme') || f.includes('pomada')) return 'SUSP/LIQ/CR/POM I, II e III';
  if (f.includes('horm')) return 'HORMONIOS';
  return 'DESCONHECIDA';
}

function findFlowByForm(forma) {
  const data = loadData();
  if (!forma) return null;

  const f = forma.toLowerCase();

  if (data.basefluxo[forma]) return data.basefluxo[forma];

  const key = Object.keys(data.basefluxo).find(k => k.toLowerCase() === f);
  return key ? data.basefluxo[key] : null;
}

function sumMO(lista) { return lista.reduce((s, a) => s + (a.execucao === 'MO' ? (a.tempo_corrida_minutos || 0) : 0), 0); }
function sumMAQ(lista) { return lista.reduce((s, a) => s + (a.execucao === 'MAQ' ? (a.tempo_corrida_minutos || 0) : 0), 0); }

export function analyzeProduct({ ativo, codigoPa, externalCode, forma, mediaMensal = 0, fatorConversao = 1, tamanhoBulk = 0, lotes = 1 }) {
  const data = loadData();

  // Resolve external code to internal PA code
  if (!codigoPa && externalCode) {
    const extMatch = lookupByExternalCode(externalCode);
    if (extMatch && extMatch.codigo_pa) {
      codigoPa = extMatch.codigo_pa;
      ativo = ativo || extMatch.ativo;
    }
    if (extMatch && !forma && extMatch.forma_farmaceutica) {
      forma = extMatch.forma_farmaceutica;
    }
    if (extMatch && !ativo) {
      ativo = extMatch.ativo || ativo;
    }
  }

  // Cross-language active ingredient synonyms
  const ACTIVE_SYNONYMS = {
    'ACETAMINOFEN': 'PARACETAMOL',
    'ACETAMINOPHEN': 'PARACETAMOL',
    'IBUPROFENO': 'IBUPROFEN',
    'DIPIRONA': 'METAMIZOL',
    'METAMIZOL': 'DIPIRONA',
    'NIMESULIDA': 'NIMESULIDE',
    'NIMESULIDE': 'NIMESULIDA',
    'ESCITALOPRAM': 'ESCITALOPRAM',
    'SERTRALINA': 'SERTRALINE',
    'SERTRALINE': 'SERTRALINA',
    'LOSARTAN': 'LOSARTANA',
    'LOSARTANA': 'LOSARTAN',
    'TRAMADOL': 'TRAMADOL',
    'SINVASTATINA': 'SINVASTATIN',
    'SINVASTATIN': 'SINVASTATINA'
  };

  let ativoUpper = (ativo || '').toUpperCase();
  // Normalize for synonym lookup (remove accents)
  const ativoNormalized = ativoUpper.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const synonym = ACTIVE_SYNONYMS[ativoNormalized];
  const searchTerms = synonym ? [ativoNormalized, synonym] : [ativoNormalized];
  let formaSelecionada = forma || null;
  let fluxoForma = {};
  let celula = 'DESCONHECIDA';
  let demandaInfo = {};

  // Step 1: Look up in DEMANDA database for product info
  if (formaSelecionada && formaSelecionada !== 'Sólidos' && formaSelecionada !== 'Injetáveis' && formaSelecionada !== 'Suspensões/Líquidos' && formaSelecionada !== 'Cremes/Pomadas') {
    const normalized = inferFormFromPharmForm(formaSelecionada);
    if (normalized) {
      console.log(`[MFVCQ] Form normalized: "${formaSelecionada}" -> "${normalized}"`);
      formaSelecionada = normalized;
    }
  }

  if (codigoPa || ativo) {
    let found = null;

    // Exact code match first (takes priority)
    if (codigoPa) {
      found = data.demanda.find(p => String(p.codigo_pa) === String(codigoPa));
    }

    // Fall back to ativo-based search if no code match
    if (!found && ativoUpper) {
      const terms = searchTerms.filter(t => t);
      for (const term of terms) {
        found = data.demanda.find(p => String(p.ativo || '').toUpperCase().includes(term));
        if (found) break;
      }
    }

    if (found) {
      celula = found.celula || celula;
      if (!formaSelecionada) formaSelecionada = inferFormFromDescription(found.descricao);
      demandaInfo = {
        codigo_pa: found.codigo_pa,
        descricao: found.descricao,
        celula: found.celula,
        media_12_meses: found.media_12_meses || 0,
        fator_conversao: found.fator_conversao || 0,
        tamanho_bulk: found.tamanho_bulk || 0,
        demanda_lotes: found.demanda_lotes || found.demanda_lotes_bulk || 0
      };
    }
  }

  // Step 2: Infer form from description if still unknown
  if (!formaSelecionada && ativo) {
    let found = null;
    for (const term of searchTerms) {
      found = data.demanda.find(p => String(p.ativo || '').toUpperCase().includes(term));
      if (found) break;
    }
    if (found) formaSelecionada = inferFormFromDescription(found.descricao);
  }

  // Step 3: Look up QC flow by pharmaceutical form (BASEFLUXO is general, not per-ativo)
  let basfluxoFallback = false;
  if (formaSelecionada) {
    fluxoForma = data.basefluxo[formaSelecionada] || {};
    if (Object.keys(fluxoForma).length === 0) {
      const f = formaSelecionada.toLowerCase();
      const key = Object.keys(data.basefluxo).find(k => k.toLowerCase() === f);
      if (key) fluxoForma = data.basefluxo[key] || {};
    }
    if (Object.keys(fluxoForma).length === 0) {
      const genericFlow = findFlowByForm(formaSelecionada);
      if (genericFlow) {
        fluxoForma = genericFlow;
        console.log(`[MFVCQ] Using generic flow for form: ${formaSelecionada}`);
      }
    }
    if (Object.keys(fluxoForma).length === 0) {
      fluxoForma = data.basefluxo['Sólidos'] || {};
      basfluxoFallback = true;
      console.log(`[MFVCQ] No BASEFLUXO for "${formaSelecionada}" — falling back to "Sólidos"`);
    }
  }

  // Step 5: Build analysis list with FIXO (Padrão) vs VARIÁVEL (Amostra) breakdown
  const nLotes = Math.max(1, Number(lotes) || 1);
  let totalFixoMin = 0, totalFixoMO = 0, totalFixoMAQ = 0;
  let totalVarMin = 0, totalVarMO = 0, totalVarMAQ = 0;
  const analisesCq = [];

  const normalizeTestData = (raw) => {
    if (raw && raw.etapas && Array.isArray(raw.etapas)) {
      return { etapas: raw.etapas, isLegacy: false };
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return {
        etapas: [{ nome: 'Geral', modo: 'sequencial', ordem: 1, atividades: raw }],
        isLegacy: true
      };
    }
    return { etapas: [], isLegacy: false };
  };

  for (const [teste, rawData] of Object.entries(fluxoForma)) {
    const { etapas } = normalizeTestData(rawData);
    if (etapas.length === 0) continue;

    const allAtividades = etapas.flatMap(e => e.atividades || []);
    if (allAtividades.length === 0) continue;

    const item = allAtividades[0];

    let fixoMO = 0, fixoMAQ = 0;
    let varMO = 0, varMAQ = 0;
    let tempoParaleloEconomia = 0;

    for (const etapa of etapas) {
      const atvs = etapa.atividades || [];
      const fixas = atvs.filter(a => a.padrao_amostra === 'Padrão');
      const variaveis = atvs.filter(a => a.padrao_amostra === 'Amostra');

      if (etapa.modo === 'paralelo') {
        const fixoMOSeq = sumMO(fixas);
        const fixoMAQSeq = sumMAQ(fixas);
        const varMOSeq = sumMO(variaveis);
        const varMAQSeq = sumMAQ(variaveis);

        fixoMO += Math.max(0, ...fixas.map(a => (a.execucao === 'MO' ? (a.tempo_corrida_minutos || 0) : 0)));
        fixoMAQ += Math.max(0, ...fixas.map(a => (a.execucao === 'MAQ' ? (a.tempo_corrida_minutos || 0) : 0)));
        varMO += Math.max(0, ...variaveis.map(a => (a.execucao === 'MO' ? (a.tempo_corrida_minutos || 0) : 0)));
        varMAQ += Math.max(0, ...variaveis.map(a => (a.execucao === 'MAQ' ? (a.tempo_corrida_minutos || 0) : 0)));

        tempoParaleloEconomia += (fixoMOSeq + fixoMAQSeq + varMOSeq + varMAQSeq) - (fixoMO + fixoMAQ + varMO + varMAQ);
      } else {
        fixoMO += sumMO(fixas);
        fixoMAQ += sumMAQ(fixas);
        varMO += sumMO(variaveis);
        varMAQ += sumMAQ(variaveis);
      }
    }

    const fixoTotal = fixoMO + fixoMAQ;
    const varTotal = varMO + varMAQ;
    const fixasCount = allAtividades.filter(a => a.padrao_amostra === 'Padrão').length;
    const variaveisCount = allAtividades.filter(a => a.padrao_amostra === 'Amostra').length;

    const tempoTesteCompartilhado = fixoTotal + (varTotal * nLotes);

    totalFixoMin += fixoTotal;
    totalFixoMO += fixoMO;
    totalFixoMAQ += fixoMAQ;
    totalVarMin += varTotal;
    totalVarMO += varMO;
    totalVarMAQ += varMAQ;

    analisesCq.push({
      tipo: 'Produto Acabado',
      teste,
      similaridade: item.similaridade || 'NÃO APLICÁVEL',
      rota: item.rota || 'DESCONHECIDA',
      fixo: {
        atividades: fixasCount,
        total_min: Math.round(fixoTotal * 100) / 100,
        mo_min: Math.round(fixoMO * 100) / 100,
        maq_min: Math.round(fixoMAQ * 100) / 100
      },
      variavel: {
        atividades: variaveisCount,
        total_min: Math.round(varTotal * 100) / 100,
        mo_min: Math.round(varMO * 100) / 100,
        maq_min: Math.round(varMAQ * 100) / 100
      },
      total_compartilhado_min: Math.round(tempoTesteCompartilhado * 100) / 100,
      total_por_lote_min: Math.round((fixoTotal + varTotal) * 100) / 100,
      mo_pct: (fixoTotal + varTotal) > 0
        ? Math.round(((fixoMO + varMO) / (fixoTotal + varTotal)) * 100) : 0,
      tempo_paralelo_economia_min: Math.round(tempoParaleloEconomia * 100) / 100,
      etapas: etapas.map(e => ({
        nome: e.nome,
        modo: e.modo,
        ordem: e.ordem
      })),
      atividades: allAtividades
    });
  }

  // Totais gerais com compartilhamento de calibração
  const tempoUnitario = totalFixoMin + totalVarMin;
  const tempoCompartilhado = totalFixoMin + (totalVarMin * nLotes);
  const totalMO = totalFixoMO + (totalVarMO * nLotes);
  const totalMAQ = totalFixoMAQ + (totalVarMAQ * nLotes);

  // Step 6: Calculate demand (prioritize DB values, fall back to parameters)
  const effectiveFatorConversao = (demandaInfo.fator_conversao > 0) ? demandaInfo.fator_conversao : (Number(fatorConversao) || 1);
  const effectiveTamanhoBulk = (demandaInfo.tamanho_bulk > 0) ? demandaInfo.tamanho_bulk : (Number(tamanhoBulk) || 0);
  const effectiveMediaMensal = (demandaInfo.media_12_meses > 0) ? demandaInfo.media_12_meses : (Number(mediaMensal) || 0);
  const demandaConvertida = effectiveMediaMensal * effectiveFatorConversao;
  const demandaLotes = effectiveTamanhoBulk > 0 ? demandaConvertida / effectiveTamanhoBulk : demandaInfo.demanda_lotes || 0;

  // Step 7: Determine cell
  if (celula === 'DESCONHECIDA' || !celula) {
    celula = determineCell(formaSelecionada);
  }

  return {
    ativo: ativoUpper,
    codigo_pa: codigoPa || demandaInfo.codigo_pa || null,
    descricao: demandaInfo.descricao || null,
    forma_farmaceutica: formaSelecionada || null,
    celula,
    quantidade_lotes: nLotes,
    basfluxo_fallback: basfluxoFallback,
    demanda: {
      ...demandaInfo,
      media_12_meses: effectiveMediaMensal || demandaInfo.media_12_meses || 0,
      fator_conversao: effectiveFatorConversao || demandaInfo.fator_conversao || 1,
      demanda_convertida: demandaConvertida,
      tamanho_bulk: effectiveTamanhoBulk || demandaInfo.tamanho_bulk || 0,
      demanda_em_lotes: Math.round(demandaLotes * 100) / 100,
      total_lotes: nLotes
    },
    analises_cq: analisesCq,
    resumo_tempos: {
      // Por lote (sem compartilhamento — modelo antigo para 1 lote)
      tempo_unitario_minutos: Math.round(tempoUnitario * 100) / 100,
      tempo_unitario_horas: Math.round((tempoUnitario / 60) * 100) / 100,

      // Fixo (calibração/padrões — executado 1x)
      fixo_minutos: Math.round(totalFixoMin * 100) / 100,
      fixo_horas: Math.round((totalFixoMin / 60) * 100) / 100,

      // Variável (amostras — executado por lote)
      variavel_por_lote_minutos: Math.round(totalVarMin * 100) / 100,
      variavel_por_lote_horas: Math.round((totalVarMin / 60) * 100) / 100,

      // Total com compartilhamento para N lotes
      tempo_compartilhado_minutos: Math.round(tempoCompartilhado * 100) / 100,
      tempo_compartilhado_horas: Math.round((tempoCompartilhado / 60) * 100) / 100,
      media_por_lote_horas: Math.round((tempoCompartilhado / nLotes / 60) * 100) / 100,

      // Carga Homem vs Máquina (compartilhada)
      carga_homem_minutos: Math.round(totalMO * 100) / 100,
      carga_homem_horas: Math.round((totalMO / 60) * 100) / 100,
      carga_maquina_minutos: Math.round(totalMAQ * 100) / 100,
      carga_maquina_horas: Math.round((totalMAQ / 60) * 100) / 100,
      carga_homem_pct: tempoCompartilhado > 0 ? Math.round((totalMO / tempoCompartilhado) * 100) : 0,

      // Comparação com modelo antigo (sem compartilhamento)
      tempo_sem_compartilhamento_horas: Math.round((tempoUnitario * nLotes / 60) * 100) / 100,
      economia_horas: Math.round(((tempoUnitario * nLotes - tempoCompartilhado) / 60) * 100) / 100,
      economia_pct: tempoUnitario * nLotes > 0
        ? Math.round(((tempoUnitario * nLotes - tempoCompartilhado) / (tempoUnitario * nLotes)) * 100) : 0,

      // Carga mensal estimada
      carga_homem_mensal_h: Math.round(((totalFixoMO + (totalVarMO * demandaLotes)) / 60) * 100) / 100,
      carga_maquina_mensal_h: Math.round(((totalFixoMAQ + (totalVarMAQ * demandaLotes)) / 60) * 100) / 100,
      tempo_total_mensal_h: Math.round(((totalFixoMin + (totalVarMin * demandaLotes)) / 60) * 100) / 100
    }
  };
}

export { lookupByExternalCode, loadExternalCodes };

function saveExternalCodes(map) {
  const p = path.join(REFS_DIR, 'external_codes.json');
  try {
    fs.writeFileSync(p, JSON.stringify(map, null, 2));
    return true;
  } catch (e) { console.error('[MFVCQ] Error saving external codes:', e.message); return false; }
}

function addExternalCode(key, entry) {
  const map = loadExternalCodes();
  if (!key || !entry || !entry.codigo_pa) return false;
  if (map[key]) return false;
  map[key] = entry;
  return saveExternalCodes(map);
}

function removeExternalCode(key) {
  const map = loadExternalCodes();
  if (!map[key]) return false;
  delete map[key];
  return saveExternalCodes(map);
}

export { addExternalCode, removeExternalCode, saveExternalCodes };

export function searchProducts({ query, limit = 10 }) {
  const data = loadData();
  const q = query.toLowerCase();

  const externalMatch = lookupByExternalCode(query);
  if (externalMatch) {
    const paMatch = externalMatch.codigo_pa
      ? data.demanda.find(p => String(p.codigo_pa) === String(externalMatch.codigo_pa))
      : null;

    if (paMatch) {
      const result = { ...paMatch, _matched_by: 'external_code', _external_code: query };
      const remaining = data.demanda
        .filter(p =>
          (String(p.descricao || '').toLowerCase().includes(q) ||
           String(p.ativo || '').toLowerCase().includes(q) ||
           String(p.codigo_pa || '').includes(q)) &&
          String(p.codigo_pa) !== String(externalMatch.codigo_pa)
        )
        .slice(0, limit - 1);
      return [result, ...remaining];
    }

    // External code matched but product not in MFVCQ — return synthetic result
    const synthetic = {
      codigo_pa: externalMatch.codigo_pa || null,
      descricao: externalMatch.descricao || '',
      ativo: externalMatch.ativo || '',
      celula: externalMatch.celula || '',
      media_12_meses: 0,
      fator_conversao: 0,
      demanda_lotes_bulk: 0,
      _matched_by: 'external_code',
      _external_code: query,
      _synthetic: true
    };
    const remaining = data.demanda
      .filter(p =>
        String(p.descricao || '').toLowerCase().includes(q) ||
        String(p.ativo || '').toLowerCase().includes(q) ||
        String(p.codigo_pa || '').includes(q)
      )
      .slice(0, limit - 1);
    return [synthetic, ...remaining];
  }

  const results = data.demanda
    .filter(p =>
      String(p.descricao || '').toLowerCase().includes(q) ||
      String(p.ativo || '').toLowerCase().includes(q) ||
      String(p.codigo_pa || '').includes(q)
    )
    .slice(0, limit);

  return results;
}

export function getIndices() {
  return loadData().indices;
}

export function getTemplate() {
  return JSON.parse(fs.readFileSync(path.join(REFS_DIR, 'template_novo_produto.json'), 'utf-8'));
}

// Fuzzy match: Gemini test names → BASEFLUXO test names
export function matchTestToBasfluxo(geminiName) {
  const g = (geminiName || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents
  const raw = (geminiName || '').toUpperCase(); // Keep accents for specificity

  // ===== MULTILINGUAL TEOR / ASSAY / VALORACION =====
  const isTeor = g.includes('TEOR') || g.includes('DOSEAMENTO') || g.includes('ASSAY') || g.includes('DOSAGE')
    || g.includes('DOSAGEM') || g.includes('VALOR') || g.includes('TITUL');
  // Exclude impurity/degredation valorations
  const isImpurityVal = isTeor && (
    g.includes('IMPUR') || g.includes('DEGRAD') || g.includes('RELACIONADA')
    || g.includes('AMINOFENOL') || g.includes('4-AMINO') || g.includes('SUBSTANCIA')
    || g.includes('ORGANICA') || g.includes('ORGANICO')
  );
  if (isTeor && !isImpurityVal) return 'TEOR HPLC 1';

  // ===== MULTILINGUAL DEGRADACAO / IMPURITIES =====
  if (g.includes('DEGRAD') || g.includes('SUBST') || g.includes('RELACIONADA')
    || g.includes('IMPUREZA') || g.includes('IMPURITY') || g.includes('RELATED')
    || g.includes('IMPURE') || g.includes('IMPUR') || g.includes('ORGANICA')
    || g.includes('ORGANICO') || g.includes('AMINOFENOL') || g.includes('4-AMINO'))
    return 'DEGRADACAO HPLC 1';

  // ===== MULTILINGUAL DISSOLUCAO =====
  if (g.includes('DISSOLU') || g.includes('DISSOLUTION') || g.includes('DISOLUCION'))
    return 'DISSOLUCAO HPLC 1';

  // ===== MULTILINGUAL DESINTEGRACAO =====
  if (g.includes('DESINTEGR') || g.includes('DISINTEGR') || g.includes('DESINTEGRACION'))
    return 'DESINTEGRACAO';

  // ===== MULTILINGUAL DUREZA / HARDNESS =====
  if (g.includes('DUREZA') || g.includes('HARDNESS') || g.includes('RESISTENCIA'))
    return 'DUREZA';

  // ===== MULTILINGUAL PESO MEDIO / WEIGHT =====
  if ((g.includes('PESO') && (g.includes('MEDIO') || g.includes('PROMEDIO')))
    || (g.includes('WEIGHT') && g.includes('AVERAGE'))
    || (g.includes('PESO') && g.includes('PROMEDIO')))
    return 'PESO MEDIO 1';

  // ===== MULTILINGUAL UMIDADE / MOISTURE / WATER =====
  if (g.includes('UMIDADE') || g.includes('MOISTURE') || g.includes('WATER')
    || g.includes('AGUA') || g.includes('HUMEDAD') || g.includes('KARL'))
    return 'UMIDADE IV';

  // ===== MULTILINGUAL UNIFORMIDADE =====
  if (g.includes('UNIFORMIDADE') || g.includes('UNIFORMITY') || g.includes('VARIACAO')
    || g.includes('VARIATION') || g.includes('UNIFORMIDAD') || g.includes('VARIACION')
    || g.includes('DOSIFICACION') || g.includes('DOSAGE'))
    return 'UNIFORMIDADE POR VARIACAO DE PESO 1';

  // ===== MULTILINGUAL DESCRICAO / APPEARANCE =====
  if (g.includes('DESCRI') || g.includes('DESCRIPTION') || g.includes('APARENCIA')
    || g.includes('APPEARANCE') || g.includes('ASPECTO') || g.includes('COLOR'))
    return 'DESCRICAO';

  // ===== MULTILINGUAL SOLUBILIDADE =====
  if (g.includes('SOLUBILIDADE') || g.includes('SOLUBILITY') || g.includes('SOLUBILIDAD'))
    return 'SOLUBILIDADE';

  // ===== MULTILINGUAL IDENTIFICACAO =====
  if ((g.includes('IDENTIFIC') && !g.includes('HPLC'))
    || (raw.includes('IDENTIFICACI') && !raw.includes('HPLC')))
    return 'IDENTIFICACAO A - Por MIR';

  if ((g.includes('IDENTIFIC') || raw.includes('IDENTIFICACI')) && g.includes('HPLC'))
    return 'TEOR HPLC 1';

  // ===== MULTILINGUAL pH =====
  if (g === 'PH' || g.startsWith('PH ') || g.includes(' PH ') || g.endsWith(' PH')) return 'pH';

  // ===== MULTILINGUAL MICROBIOLOGIA =====
  if (g.includes('MICROBIOL') || g.includes('MICROBIOLOGY') || g.includes('RECUENTO')
    || g.includes('CONTAGEM') || g.includes('BACTERIA') || g.includes('FUNGO')
    || g.includes('HONGOS') || g.includes('LEVEDURA') || g.includes('MOHO')
    || g.includes('EFECTIVIDAD') || g.includes('PRESERVANTE') || g.includes('EFFECTIVENESS')
    || g.includes('ESTERILIDADE') || g.includes('ESTERILIDAD') || g.includes('STERILITY'))
    return 'UMIDADE IV'; // Map to microbiology category placeholder

  // ===== GRAVEDAD ESPECIFICA / DENSITY (before ROTACAO to avoid ESPECIFICA conflict) =====
  if (g.includes('GRAVEDAD') || g.includes('GRAVITY') || g.includes('DENSIDADE')
    || g.includes('DENSIDAD') || g.includes('DENSITY'))
    return 'PESO MEDIO 1'; // Closest match — physical test

  // ===== ROTACAO ESPECIFICA / OPTICAL ROTATION =====
  if (g.includes('ROTACAO') || g.includes('ROTACION') || g.includes('ROTATION')
    || g.includes('POLARIMETRIA') || g.includes('POLARIMETRY'))
    return 'ROTACAO ESPECIFICA';

  // ===== FRACIONAMENTO / FRACTION =====
  if (g.includes('FRACIONAMENTO') || g.includes('FRACTION'))
    return 'FRACIONAMENTO DE AMOSTRA';

  // ===== SEPARACAO =====
  if (g.includes('SEPARA') || g.includes('SEPARAT'))
    return 'SEPARACAO_AMOSTRAS';

  // ===== MOVIMENTADOR / HANDLING =====
  if (g.includes('MOVIMENTADOR') || g.includes('HANDLING'))
    return 'ATIVIDADE MOVIMENTADOR';

  // ===== LIMITE DE N,N-DIMETILANILINA =====
  if (g.includes('DIMETILANILINA') || g.includes('DIMETHYLANILINE'))
    return 'LIMITE DE N,N-DIMETILANILINA';

  return null;
}

function isHplcRunActivity(a) {
  return a.injecoes !== undefined;
}

function buildConfiguredRotas(testName, tempoPorInjecao) {
  // Primary source: BASEFLUXO activities
  const data = loadData();
  const bfActivities = [];
  for (const forma of Object.values(data.basefluxo)) {
    const atividades = forma[testName];
    if (Array.isArray(atividades) && atividades.length > 0) {
      for (const a of atividades) {
        if (isHplcRunActivity(a)) {
          bfActivities.push({
            descricao: a.atividade,
            rota: a.rota,
            execucao: a.execucao || 'MAQ',
            padrao_amostra: a.padrao_amostra || 'Padrão',
            tempo_min: Math.round((a.injecoes || 0) * (tempoPorInjecao || 0) * 100) / 100
          });
        } else {
          bfActivities.push({
            descricao: a.atividade,
            rota: a.rota,
            execucao: a.execucao || 'MAQ',
            padrao_amostra: a.padrao_amostra || 'Padrão',
            tempo_min: a.tempo_corrida_minutos || 0
          });
        }
      }
      break;
    }
  }
  if (bfActivities.length > 0) {
    const rotasMap = {};
    for (const a of bfActivities) {
      if (!rotasMap[a.rota]) rotasMap[a.rota] = { nome: a.rota, tipo: a.execucao === 'MO' ? 'Analista' : 'Máquina', execucao: a.execucao, descricao: '', diretrizes: [] };
    }
    return { rotas: Object.values(rotasMap), atividades: bfActivities };
  }

  // Fallback: tests.json (only if test has diretrizes for AI hints)
  const config = loadTestConfig();
  const t = config[testName];
  if (!t) return null;

  const configRotas = (t.rotas || []).map(r => ({
    nome: typeof r === 'string' ? r : r.nome,
    tipo: typeof r === 'string' ? 'Analista' : (r.tipo || 'Analista'),
    execucao: typeof r === 'string' ? 'MO' : 'MO',
    descricao: typeof r === 'string' ? '' : (r.descricao || ''),
    diretrizes: typeof r === 'string' ? [] : (r.diretrizes || [])
  }));

  return { rotas: configRotas, atividades: [] };
}

function rebuildFixoVariavel(atividades) {
  const fixas = atividades.filter(a => a.padrao_amostra === 'Padrão');
  const variaveis = atividades.filter(a => a.padrao_amostra === 'Amostra');

  const fixoMO = fixas.filter(a => a.execucao === 'MO').reduce((s, a) => s + a.tempo_min, 0);
  const fixoMAQ = fixas.filter(a => a.execucao === 'MAQ').reduce((s, a) => s + a.tempo_min, 0);
  const fixoTotal = fixoMO + fixoMAQ;

  const varMO = variaveis.filter(a => a.execucao === 'MO').reduce((s, a) => s + a.tempo_min, 0);
  const varMAQ = variaveis.filter(a => a.execucao === 'MAQ').reduce((s, a) => s + a.tempo_min, 0);
  const varTotal = varMO + varMAQ;

  return {
    fixo: {
      atividades: fixas.length,
      total_min: Math.round(fixoTotal * 100) / 100,
      mo_min: Math.round(fixoMO * 100) / 100,
      maq_min: Math.round(fixoMAQ * 100) / 100
    },
    variavel: {
      atividades: variaveis.length,
      total_min: Math.round(varTotal * 100) / 100,
      mo_min: Math.round(varMO * 100) / 100,
      maq_min: Math.round(varMAQ * 100) / 100
    }
  };
}

export function getBasfluxoForTests({ ativo, forma, geminiRows, lotes = 1 }) {
  const full = analyzeProduct({ ativo, forma, lotes });
  const config = loadTestConfig();
  let aliasesAdded = 0;
  const hasBasfluxo = full && full.analises_cq?.length > 0;

  // Use demand-based lot count from MFVCQ spreadsheet, fall back to parameter
  const demandLotesFromDb = full?.demanda?.demanda_em_lotes || 0;
  const effectiveLotes = demandLotesFromDb > 0 ? Math.ceil(demandLotesFromDb) : (lotes || 1);

  if (!hasBasfluxo) {
    console.log(`[MFVCQ] No BASEFLUXO flow for forma "${forma}" — using keyword-only matching`);
  }

  const vault = loadVault();
  const geminiTests = (geminiRows || []).map(r => ({
    name: r.testName || r.teste || '',
    totalMin: (r.t_prep || 0) + (r.t_analysis || 0) + (r.t_run || 0) + (r.t_calc || 0) + (r.t_incubation || 0),
    t_run: r.t_run || 0
  }));

  const matchedBasfluxo = geminiTests
    .map(g => {
      // Try vault first, then fall back to keyword matcher
      let match = findSimilar(g.name);
      if (match) {
        // Auto-expand alias — learn from this match
        const expansion = expandAlias(match.teste, g.name.trim(), match.score);
        if (expansion.action !== 'skip') {
          if (expansion.action === 'auto_added') aliasesAdded++;
          console.log(`[MFVCQ] Alias expansion: ${expansion.action} — "${match.teste}" ← "${g.name}"`);
        }

        const t = hasBasfluxo ? full.analises_cq.find(a => a.teste === match.teste) : null;
        if (!t) {
          // No BASEFLUXO entry for this test — use config-based rotas
          const configRotas = buildConfiguredRotas(match.teste, 0);
          const hasConfigRotas = configRotas && configRotas.rotas?.length > 0;
          return {
            geminiMatch: g.name,
            score: match.score,
            source: 'vault',
            stub: !hasConfigRotas && full && !hasBasfluxo ? false : !t,
            // No BASEFLUXO = no time data, use Gemini's own estimate
            teste: match.teste,
            rota: configRotas?.rotas?.[0]?.nome || 'N/A',
            geminiTotalMin: g.totalMin,
            basfluxoTotalMin: 0,
            scale: 0,
            fixo: { total_min: 0, mo_min: 0, maq_min: 0 },
            variavel: { total_min: 0, mo_min: 0, maq_min: 0 },
            total_compartilhado_min: g.totalMin,
            mo_pct: 0,
            configRotas: hasConfigRotas ? configRotas.rotas : null,
            atividades: hasConfigRotas ? configRotas.atividades : []
          };
        }
        // Calculate tempoPorInjecao from Gemini's t_run vs BASEFLUXO total injections
        const totalInjecoes = t.atividades
          ? t.atividades
              .filter(a => isHplcRunActivity(a))
              .reduce((s, a) => s + (a.injecoes || 0), 0)
          : 0;
        const geminiRun = g.t_run || 0;
        const tempoPorInjecao = geminiRun > 0 && totalInjecoes > 0 ? geminiRun / totalInjecoes : 0;

        // Use learned scale from config if available (calibrated from Learning journal)
        const tConfig = config[match.teste];
        const learnedScale = tConfig?.learned_scale;
        const effectiveTempoPorInjecao = learnedScale ? tempoPorInjecao * learnedScale : tempoPorInjecao;

        // Use configured rotas from tests.json if available
        const configRotas = buildConfiguredRotas(match.teste, effectiveTempoPorInjecao);
        const scaledAtividades = configRotas?.atividades
          || t.atividades.map(a => {
              if (isHplcRunActivity(a)) {
                return {
                  descricao: a.atividade, rota: a.rota, execucao: a.execucao, padrao_amostra: a.padrao_amostra,
                  tempo_min: Math.round((a.injecoes || 0) * effectiveTempoPorInjecao * 100) / 100
                };
              }
              return {
                descricao: a.atividade, rota: a.rota, execucao: a.execucao, padrao_amostra: a.padrao_amostra,
                tempo_min: a.tempo_corrida_minutos || 0
              };
            });
        const rebuilt = rebuildFixoVariavel(scaledAtividades);
        const bfTotalRaw = (t.fixo?.total_min || 0) + (t.variavel?.total_min || 0);
        return {
          teste: t.teste,
          geminiMatch: g.name,
          score: match.score,
          source: 'vault',
          rota: t.rota,
          geminiTotalMin: g.totalMin,
          basfluxoTotalMin: bfTotalRaw,
          scale: tempoPorInjecao,
          learned_scale: learnedScale || null,
          effective_scale: effectiveTempoPorInjecao,
          fixo: rebuilt.fixo,
          variavel: rebuilt.variavel,
          total_compartilhado_min: Math.round((rebuilt.fixo.total_min + rebuilt.variavel.total_min * effectiveLotes) * 100) / 100,
          mo_pct: t.mo_pct,
          configRotas: configRotas?.rotas || null,
          atividades: scaledAtividades
        };
      }

      // Fallback: keyword-based matcher
      const kwMatch = matchTestToBasfluxo(g.name);
      if (kwMatch) {
        const t = hasBasfluxo ? full.analises_cq.find(a => a.teste === kwMatch) : null;
        if (!t) {
          if (!hasBasfluxo) {
            // Keyword match without BASEFLUXO — return with config rotas
            const configRotas = buildConfiguredRotas(kwMatch, 0);
            return {
              teste: kwMatch,
              geminiMatch: g.name,
              score: 60,
              source: 'keyword',
              rota: configRotas?.rotas?.[0]?.nome || 'N/A',
              geminiTotalMin: g.totalMin,
              basfluxoTotalMin: 0,
              scale: 0,
              fixo: { total_min: 0, mo_min: 0, maq_min: 0 },
              variavel: { total_min: 0, mo_min: 0, maq_min: 0 },
              total_compartilhado_min: g.totalMin,
              mo_pct: 0,
              configRotas: null,
              atividades: []
            };
          }
          return null;
        }
        const bfTotal = (t.fixo?.total_min || 0) + (t.variavel?.total_min || 0);
        const totalInjecoes = t.atividades
          ? t.atividades
              .filter(a => isHplcRunActivity(a))
              .reduce((s, a) => s + (a.injecoes || 0), 0)
          : 0;
        const geminiRun = g.t_run || 0;
        const tempoPorInjecao = geminiRun > 0 && totalInjecoes > 0 ? geminiRun / totalInjecoes : 0;

        const tConfig = config[kwMatch];
        const learnedScale = tConfig?.learned_scale;
        const effectiveTempoPorInjecao = learnedScale ? tempoPorInjecao * learnedScale : tempoPorInjecao;

        const configRotas = buildConfiguredRotas(kwMatch, effectiveTempoPorInjecao);
        const scaledAtividades = configRotas?.atividades
          || t.atividades.map(a => {
              if (isHplcRunActivity(a)) {
                return {
                  descricao: a.atividade, rota: a.rota, execucao: a.execucao, padrao_amostra: a.padrao_amostra,
                  tempo_min: Math.round((a.injecoes || 0) * effectiveTempoPorInjecao * 100) / 100
                };
              }
              return {
                descricao: a.atividade, rota: a.rota, execucao: a.execucao, padrao_amostra: a.padrao_amostra,
                tempo_min: a.tempo_corrida_minutos || 0
              };
            });
        const rebuilt = rebuildFixoVariavel(scaledAtividades);
        return {
          teste: t.teste,
          geminiMatch: g.name,
          score: 60,
          source: 'keyword',
          rota: t.rota,
          geminiTotalMin: g.totalMin,
          basfluxoTotalMin: bfTotal,
          scale: tempoPorInjecao,
          learned_scale: learnedScale || null,
          effective_scale: effectiveTempoPorInjecao,
          fixo: rebuilt.fixo,
          variavel: rebuilt.variavel,
          total_compartilhado_min: Math.round((rebuilt.fixo.total_min + rebuilt.variavel.total_min * effectiveLotes) * 100) / 100,
          mo_pct: t.mo_pct,
          configRotas: configRotas?.rotas || null,
          atividades: scaledAtividades
        };
      }

      // No match — create stub
      const technique = geminiRows.find(r => (r.testName || r.teste) === g.name)?.technique || '';
      createStub({ testName: g.name, technique, productName: ativo || '' });
      return { geminiMatch: g.name, score: 0, source: 'stub', stub: true };
    })
    .filter(Boolean);

  const withRotas = matchedBasfluxo.filter(t => !t.stub);

  return {
    celula: full?.celula || 'N/A',
    quantidade_lotes: effectiveLotes,
    demanda_lotes_origem: demandLotesFromDb > 0 ? 'MFVCQ' : 'parametro',
    noBasfluxo: !hasBasfluxo,
    stats: {
      totalGeminiTests: geminiTests.length,
      matched: withRotas.length,
      stubs: matchedBasfluxo.length - withRotas.length,
      vaultMatches: matchedBasfluxo.filter(t => t.source === 'vault').length,
      keywordMatches: matchedBasfluxo.filter(t => t.source === 'keyword').length,
      aliasesAdded
    },
    resumo_tempos: {
      tempo_compartilhado_horas: withRotas.reduce((s, t) => s + (t.total_compartilhado_min / 60), 0),
      carga_homem_horas: withRotas.reduce((s, t) => s + ((t.fixo?.mo_min || 0) + (t.variavel?.mo_min || 0)) / 60, 0),
      carga_maquina_horas: withRotas.reduce((s, t) => s + ((t.fixo?.maq_min || 0) + (t.variavel?.maq_min || 0)) / 60, 0),
      fixo_horas: withRotas.reduce((s, t) => s + (t.fixo?.total_min || 0) / 60, 0),
      variavel_por_lote_horas: withRotas.reduce((s, t) => s + (t.variavel?.total_min || 0) / 60, 0),
      carga_homem_pct: withRotas.length > 0
        ? Math.round(withRotas.reduce((s, t) => s + ((t.fixo?.mo_min || 0) + (t.variavel?.mo_min || 0)), 0)
          / withRotas.reduce((s, t) => s + t.total_compartilhado_min, 0) * 100) : 0
    },
    testes: matchedBasfluxo
  };
}
