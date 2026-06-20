import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  if (d.includes('COMP') || d.includes('CPR') || d.includes('CAP') || d.includes('DRG')) return 'Sólidos';
  if (d.includes('INJ') || d.includes('SOL') || d.includes('AMP')) return 'Injetáveis';
  if (d.includes('SUS') || d.includes('XAR') || d.includes('ELI')) return 'Suspensões/Líquidos';
  if (d.includes('CR') || d.includes('POM') || d.includes('GEL')) return 'Cremes/Pomadas';
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

export function analyzeProduct({ ativo, codigoPa, forma, mediaMensal = 0, fatorConversao = 1, tamanhoBulk = 0 }) {
  const data = loadData();
  const ativoUpper = (ativo || '').toUpperCase();
  let formaSelecionada = forma || null;
  let fluxoForma = {};
  let celula = 'DESCONHECIDA';
  let demandaInfo = {};

  // Step 1: Look up in DEMANDA database for product info
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

  // Step 5: Build analysis list
  let tempoTotalMinutos = 0;
  const analisesCq = [];

  for (const [teste, atividades] of Object.entries(fluxoForma)) {
    if (Array.isArray(atividades) && atividades.length > 0) {
      const item = atividades[0];
      const tempoTeste = atividades.reduce((sum, a) => sum + (a.tempo_corrida_minutos || 0), 0);
      tempoTotalMinutos += tempoTeste;

      analisesCq.push({
        tipo: 'Produto Acabado',
        teste,
        similaridade: item.similaridade || 'NÃO APLICÁVEL',
        rota: item.rota || 'DESCONHECIDA',
        atividades
      });
    }
  }

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
    demanda: {
      ...demandaInfo,
      media_12_meses: Number(mediaMensal) || demandaInfo.media_12_meses || 0,
      fator_conversao: Number(fatorConversao) || 1,
      demanda_convertida: demandaConvertida,
      tamanho_bulk: Number(tamanhoBulk) || 0,
      demanda_em_lotes: Math.round(demandaLotes * 100) / 100
    },
    analises_cq: analisesCq,
    resumo_tempos: {
      tempo_unitario_minutos: tempoTotalMinutos,
      tempo_unitario_horas: Math.round((tempoTotalMinutos / 60) * 100) / 100,
      tempo_total_lotes_minutos: Math.round(tempoTotalMinutos * demandaLotes * 100) / 100,
      tempo_total_lotes_horas: Math.round((tempoTotalMinutos * demandaLotes / 60) * 100) / 100
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
