import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadVault, findSimilar, createStub } from './knowledge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REFS_DIR = path.join(__dirname, 'reference');

let basefluxo = null;
let demanda = null;
let indices = null;

function loadData() {
  if (basefluxo) return { basefluxo, demanda, indices };
  basefluxo = JSON.parse(fs.readFileSync(path.join(REFS_DIR, 'basefluxo_estruturado.json'), 'utf-8'));
  demanda = JSON.parse(fs.readFileSync(path.join(REFS_DIR, 'demanda_estruturada.json'), 'utf-8'));
  indices = JSON.parse(fs.readFileSync(path.join(REFS_DIR, 'indices_busca.json'), 'utf-8'));
  return { basefluxo, demanda, indices };
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
  let genericForm = forma;

  if (!genericForm) return null;

  // Normalize form name
  const f = genericForm.toLowerCase();

  // Try exact match first across all ativos
  for (const ativo of Object.values(data.basefluxo)) {
    if (ativo[genericForm]) return ativo[genericForm];
    // Try case-insensitive
    const key = Object.keys(ativo).find(k => k.toLowerCase() === f);
    if (key) return ativo[key];
  }

  return null;
}

function sumMO(lista) { return lista.reduce((s, a) => s + (a.execucao === 'MO' ? (a.tempo_corrida_minutos || 0) : 0), 0); }
function sumMAQ(lista) { return lista.reduce((s, a) => s + (a.execucao === 'MAQ' ? (a.tempo_corrida_minutos || 0) : 0), 0); }

export function analyzeProduct({ ativo, codigoPa, forma, mediaMensal = 0, fatorConversao = 1, tamanhoBulk = 0, lotes = 1 }) {
  const data = loadData();
  const ativoUpper = (ativo || '').toUpperCase();
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
    const found = data.demanda.find(p =>
      (codigoPa && String(p.codigo_pa) === String(codigoPa)) ||
      (ativo && String(p.ativo || '').toUpperCase() === ativoUpper)
    );
    if (found) {
      celula = found.celula || celula;
      if (!formaSelecionada) formaSelecionada = inferFormFromDescription(found.descricao);
      demandaInfo = {
        codigo_pa: found.codigo_pa,
        descricao: found.descricao,
        celula: found.celula,
        media_12_meses: found.media_12_meses || 0
      };
    }
  }

  // Step 2: Infer form from description if still unknown
  if (!formaSelecionada && ativo) {
    const found = data.demanda.find(p => String(p.ativo || '').toUpperCase() === ativoUpper);
    if (found) formaSelecionada = inferFormFromDescription(found.descricao);
  }

  // Step 3: Look up QC flow — try by ativo first, then by form
  let fluxoAtivo = data.basefluxo[ativoUpper];
  if (!fluxoAtivo) {
    const similar = Object.keys(data.basefluxo).find(k => k.includes(ativoUpper) || ativoUpper.includes(k));
    if (similar) fluxoAtivo = data.basefluxo[similar];
  }

  if (fluxoAtivo) {
    // Found by active ingredient — use its form
    if (formaSelecionada && fluxoAtivo[formaSelecionada]) {
      fluxoForma = fluxoAtivo[formaSelecionada];
    } else {
      const keys = Object.keys(fluxoAtivo).filter(k => k !== 'FORMA FARMACÊUTICA');
      if (keys.length === 1) {
        formaSelecionada = keys[0];
        fluxoForma = fluxoAtivo[formaSelecionada];
      }
    }
  }

  // Step 4: If still no flow, try by pharmaceutical form (generic)
  if (Object.keys(fluxoForma).length === 0 && formaSelecionada) {
    const genericFlow = findFlowByForm(formaSelecionada);
    if (genericFlow) {
      fluxoForma = genericFlow;
      console.log(`[MFVCQ] Using generic flow for form: ${formaSelecionada}`);
    }
  }

  // Step 5: Build analysis list with FIXO (Padrão) vs VARIÁVEL (Amostra) breakdown
  const nLotes = Math.max(1, Number(lotes) || 1);
  let totalFixoMin = 0, totalFixoMO = 0, totalFixoMAQ = 0;
  let totalVarMin = 0, totalVarMO = 0, totalVarMAQ = 0;
  const analisesCq = [];

  for (const [teste, atividades] of Object.entries(fluxoForma)) {
    if (Array.isArray(atividades) && atividades.length > 0) {
      const item = atividades[0];

      // Separate by padrao_amostra
      const fixas = atividades.filter(a => a.padrao_amostra === 'Padrão');
      const variaveis = atividades.filter(a => a.padrao_amostra === 'Amostra');

      const fixoMO = sumMO(fixas);
      const fixoMAQ = sumMAQ(fixas);
      const fixoTotal = fixoMO + fixoMAQ;

      const varMO = sumMO(variaveis);
      const varMAQ = sumMAQ(variaveis);
      const varTotal = varMO + varMAQ;

      // Tempo total considerando compartilhamento
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
        },
        total_compartilhado_min: Math.round(tempoTesteCompartilhado * 100) / 100,
        total_por_lote_min: Math.round((fixoTotal + varTotal) * 100) / 100,
        mo_pct: (fixoTotal + varTotal) > 0
          ? Math.round(((fixoMO + varMO) / (fixoTotal + varTotal)) * 100) : 0,
        atividades
      });
    }
  }

  // Totais gerais com compartilhamento de calibração
  const tempoUnitario = totalFixoMin + totalVarMin;
  const tempoCompartilhado = totalFixoMin + (totalVarMin * nLotes);
  const totalMO = totalFixoMO + (totalVarMO * nLotes);
  const totalMAQ = totalFixoMAQ + (totalVarMAQ * nLotes);

  // Step 6: Calculate demand
  const demandaConvertida = Number(mediaMensal) * Number(fatorConversao);
  const demandaLotes = Number(tamanhoBulk) > 0 ? demandaConvertida / Number(tamanhoBulk) : 0;

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
    demanda: {
      ...demandaInfo,
      media_12_meses: Number(mediaMensal) || demandaInfo.media_12_meses || 0,
      fator_conversao: Number(fatorConversao) || 1,
      demanda_convertida: demandaConvertida,
      tamanho_bulk: Number(tamanhoBulk) || 0,
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

export function searchProducts({ query, limit = 10 }) {
  const data = loadData();
  const q = query.toLowerCase();

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
function matchTestToBasfluxo(geminiName) {
  const g = (geminiName || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents

  // Teor / Doseamento / Assay → TEOR HPLC
  if (g.includes('TEOR') || g.includes('DOSEAMENTO') || g.includes('ASSAY') || g.includes('DOSAGE') || g.includes('DOSAGEM'))
    return 'TEOR HPLC 1';

  // Degradação / Impurezas / Substâncias Relacionadas → DEGRADAÇÃO HPLC
  if (g.includes('DEGRAD') || g.includes('SUBST') || g.includes('RELACIONADA') || g.includes('IMPUREZA') || g.includes('IMPURITY') || g.includes('RELATED') || g.includes('IMPURE'))
    return 'DEGRADAÇÃO HPLC 1';

  // Dissolução → DISSOLUÇÃO
  if (g.includes('DISSOLU') || g.includes('DISSOLUTION'))
    return 'DISSOLUÇÃO HPLC 1';

  // Desintegração → DESINTEGRAÇÃO
  if (g.includes('DESINTEGR') || g.includes('DISINTEGR'))
    return 'DESINTEGRAÇÃO';

  // Dureza → DUREZA
  if (g.includes('DUREZA') || g.includes('HARDNESS'))
    return 'DUREZA';

  // Peso Médio → PESO MÉDIO
  if ((g.includes('PESO') && g.includes('MEDIO')) || (g.includes('WEIGHT') && g.includes('AVERAGE')))
    return 'PESO MÉDIO 1';

  // Umidade → UMIDADE
  if (g.includes('UMIDADE') || g.includes('MOISTURE') || g.includes('WATER') || g.includes('AGUA'))
    return 'UMIDADE IV';

  // Uniformidade → UNIFORMIDADE POR VARIAÇÃO DE PESO
  if (g.includes('UNIFORMIDADE') || g.includes('UNIFORMITY') || g.includes('VARIACAO') || g.includes('VARIATION'))
    return 'UNIFORMIDADE POR VARIAÇÃO DE PESO 1';

  // Fracionamento → FRACIONAMENTO
  if (g.includes('FRACIONAMENTO') || g.includes('FRACTION'))
    return 'FRACIONAMENTO DE AMOSTRA';

  // Separação → SEPARAÇÃO
  if (g.includes('SEPARA') || g.includes('SEPARAT'))
    return 'SEPARAÇÃO_AMOSTRAS';

  // Movimentador → MOVIMENTADOR
  if (g.includes('MOVIMENTADOR') || g.includes('HANDLING'))
    return 'ATIVIDADE MOVIMENTADOR';

  // Identificação via HPLC → TEOR
  if (g.includes('IDENTIFICACAO') && g.includes('HPLC'))
    return 'TEOR HPLC 1';

  return null;
}

export function getBasfluxoForTests({ ativo, forma, geminiRows, lotes = 1 }) {
  const full = analyzeProduct({ ativo, forma, lotes });

  if (!full || !full.analises_cq?.length) return null;

  const vault = loadVault();
  const geminiTests = (geminiRows || []).map(r => r.testName || r.teste || '');

  const matchedBasfluxo = geminiTests
    .map(gName => {
      // Try vault first, then fall back to keyword matcher
      let match = findSimilar(gName);
      if (match) {
        const t = full.analises_cq.find(a => a.teste === match.teste);
        if (!t) {
          // Vault found a test but it's not in the current BASEFLUXO flow
          return { geminiMatch: gName, score: match.score, source: 'vault', stub: true };
        }
        return {
          teste: t.teste,
          geminiMatch: gName,
          score: match.score,
          source: 'vault',
          rota: t.rota,
          fixo: t.fixo,
          variavel: t.variavel,
          total_compartilhado_min: t.total_compartilhado_min,
          mo_pct: t.mo_pct,
          atividades: t.atividades.map(a => ({
            descricao: a.atividade,
            rota: a.rota,
            execucao: a.execucao,
            padrao_amostra: a.padrao_amostra,
            tempo_min: a.tempo_corrida_minutos
          }))
        };
      }

      // Fallback: keyword-based matcher
      const kwMatch = matchTestToBasfluxo(gName);
      if (kwMatch) {
        const t = full.analises_cq.find(a => a.teste === kwMatch);
        if (!t) return null;
        return {
          teste: t.teste,
          geminiMatch: gName,
          score: 60,
          source: 'keyword',
          rota: t.rota,
          fixo: t.fixo,
          variavel: t.variavel,
          total_compartilhado_min: t.total_compartilhado_min,
          mo_pct: t.mo_pct,
          atividades: t.atividades.map(a => ({
            descricao: a.atividade,
            rota: a.rota,
            execucao: a.execucao,
            padrao_amostra: a.padrao_amostra,
            tempo_min: a.tempo_corrida_minutos
          }))
        };
      }

      // No match — create stub
      const technique = geminiRows.find(r => r.testName === gName)?.technique || '';
      createStub({ testName: gName, technique, productName: ativo || '' });
      return { geminiMatch: gName, score: 0, source: 'stub', stub: true };
    })
    .filter(Boolean);

  const withRotas = matchedBasfluxo.filter(t => !t.stub);

  return {
    celula: full.celula,
    quantidade_lotes: full.quantidade_lotes,
    stats: {
      totalGeminiTests: geminiTests.length,
      matched: withRotas.length,
      stubs: matchedBasfluxo.length - withRotas.length,
      vaultMatches: matchedBasfluxo.filter(t => t.source === 'vault').length,
      keywordMatches: matchedBasfluxo.filter(t => t.source === 'keyword').length
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
