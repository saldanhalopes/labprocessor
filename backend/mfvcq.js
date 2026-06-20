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

export function analyzeProduct({ ativo, codigoPa, forma, mediaMensal = 0, fatorConversao = 1, tamanhoBulk = 0 }) {
  const data = loadData();
  const ativoUpper = ativo.toUpperCase();

  let fluxoAtivo = data.basefluxo[ativoUpper];
  if (!fluxoAtivo) {
    const similar = Object.keys(data.basefluxo).find(k => k.includes(ativoUpper) || ativoUpper.includes(k));
    if (similar) fluxoAtivo = data.basefluxo[similar];
  }

  let fluxoForma = {};
  let formaSelecionada = forma;

  if (fluxoAtivo) {
    if (forma && fluxoAtivo[forma]) {
      fluxoForma = fluxoAtivo[forma];
    } else {
      const keys = Object.keys(fluxoAtivo);
      if (keys.length === 1) {
        formaSelecionada = keys[0];
        fluxoForma = fluxoAtivo[formaSelecionada];
      }
    }
  }

  let tempoTotalMinutos = 0;
  const analisesCq = [];

  for (const [teste, atividades] of Object.entries(fluxoForma)) {
    if (Array.isArray(atividades) && atividades.length > 0) {
      const item = atividades[0];
      const tempoTeste = atividades.reduce((sum, a) => sum + (a.tempo_corrida_minutos || 0), 0);
      tempoTotalMinutos += tempoTeste;

      analisesCq.push({
        tipo: 'Bulk',
        teste,
        similaridade: item.similaridade || 'NÃO APLICÁVEL',
        rota: item.rota || 'DESCONHECIDA',
        atividades
      });
    }
  }

  const demandaConvertida = Number(mediaMensal) * Number(fatorConversao);
  const demandaLotes = Number(tamanhoBulk) > 0 ? demandaConvertida / Number(tamanhoBulk) : 0;

  return {
    ativo: ativoUpper,
    codigo_pa: codigoPa || null,
    forma_farmaceutica: formaSelecionada || null,
    celula: determineCell(formaSelecionada),
    demanda: {
      media_12_meses: Number(mediaMensal),
      fator_conversao: Number(fatorConversao),
      demanda_convertida: demandaConvertida,
      tamanho_bulk: Number(tamanhoBulk),
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
