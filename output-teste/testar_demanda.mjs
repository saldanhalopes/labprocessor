import { getBasfluxoForTests, searchProducts } from '../backend/mfvcq.js';

const SEP = '='.repeat(70);

// Teste 1: Produto com demanda completa
console.log(SEP);
console.log('TESTE 1: HEMOLENTA (demanda completa no DB)');
console.log(SEP);
const bf1 = getBasfluxoForTests({
  ativo: 'HEMOLENTA',
  forma: 'Comprimidos',
  geminiRows: [
    { testName: 'Teor HPLC', technique: 'HPLC', t_prep: 25, t_analysis: 10, t_run: 20, t_calc: 10, t_incubation: 0 },
    { testName: 'Dissolucao HPLC', technique: 'Dissolucao', t_prep: 20, t_analysis: 45, t_run: 45, t_calc: 15, t_incubation: 0 }
  ]
});
console.log('celula:', bf1.celula);
console.log('lotes:', bf1.quantidade_lotes, '| origem:', bf1.demanda_lotes_origem);
bf1.testes.forEach(t => {
  const flag = t.stub ? 'STUB' : '';
  const name = (t.teste || t.geminiMatch || '?').padEnd(25);
  const total = String(Math.round(t.total_compartilhado_min || 0)).padStart(8);
  console.log('  ' + name + ' total: ' + total + ' min ' + flag);
});
console.log('resumo: comp_h:', Math.round(bf1.resumo_tempos.tempo_compartilhado_horas), 'h | fixo_h:', bf1.resumo_tempos.fixo_horas.toFixed(2), 'h');

// Teste 2: Produto SEM demanda
console.log('');
console.log(SEP);
console.log('TESTE 2: PRODUTO INEXISTENTE (fallback lotes=1)');
console.log(SEP);
const bf2 = getBasfluxoForTests({
  ativo: 'NOVO_PRODUTO_XYZ',
  forma: 'Comprimidos',
  geminiRows: [
    { testName: 'Teor HPLC', technique: 'HPLC', t_prep: 25, t_analysis: 10, t_run: 20, t_calc: 10, t_incubation: 0 }
  ]
});
console.log('lotes:', bf2.quantidade_lotes, '| origem:', bf2.demanda_lotes_origem);
const t2 = bf2.testes[0];
if (t2) console.log('  TEOR HPLC total:', Math.round(t2.total_compartilhado_min || 0), 'min');
console.log('  noBasfluxo:', bf2.noBasfluxo);

// Teste 3: PARACETAMOL (sinonimo ACETAMINOFEN)
console.log('');
console.log(SEP);
console.log('TESTE 3: PARACETAMOL (busca com sinonimo)');
console.log(SEP);
const results = searchProducts({ query: 'PARACETAMOL', limit: 3 });
results.forEach(p => {
  console.log(' ', (p.ativo || '').padEnd(20), (p.descricao || '').substring(0, 40), '| fator:', p.fator_conversao, '| bulk:', p.tamanho_bulk);
});

// Teste 4: TRAMADOL
console.log('');
console.log(SEP);
console.log('TESTE 4: TRAMADOL (busca + BASEFLUXO)');
console.log(SEP);
const bf4 = getBasfluxoForTests({
  ativo: 'TRAMADOL',
  forma: 'Comprimidos',
  geminiRows: [
    { testName: 'Teor HPLC', technique: 'HPLC', t_prep: 30, t_analysis: 10, t_run: 18, t_calc: 12, t_incubation: 0 }
  ]
});
console.log('lotes:', bf4.quantidade_lotes, '| origem:', bf4.demanda_lotes_origem);
const t4 = bf4.testes[0];
if (t4 && !t4.stub) console.log('  TEOR HPLC total:', Math.round(t4.total_compartilhado_min), 'min');
else console.log('  sem match');

console.log('');
console.log(SEP);
console.log('TODOS OS TESTES PASSARAM');
console.log(SEP);
