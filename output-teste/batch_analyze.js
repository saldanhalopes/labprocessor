const fs = require('fs');
const http = require('http');

const products = JSON.parse(fs.readFileSync('output-teste/batch_products.json', 'utf-8'));

async function analyze(p) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      ativo: p.active,
      forma: p.form,
      lotes: 1
    });
    const req = http.request({
      hostname: 'localhost',
      port: 8080,
      path: '/api/mfvcq/analyze',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(d);
          resolve({
            file: p.file,
            name: p.name,
            active: p.active,
            form: p.form,
            celula: result.celula || '-',
            testes: result.analises_cq?.length || 0,
            tempo_h: result.resumo_tempos?.tempo_compartilhado_horas || result.resumo_tempos?.tempo_unitario_horas || 0,
            homem_h: result.resumo_tempos?.carga_homem_horas || 0,
            maquina_h: result.resumo_tempos?.carga_maquina_horas || 0,
            economia_pct: result.resumo_tempos?.economia_pct || 0,
            descricao: result.descricao || ''
          });
        } catch(e) {
          resolve({ file: p.file, name: p.name, active: p.active, form: p.form, celula: 'ERRO', testes: 0, tempo_h: 0, homem_h: 0, maquina_h: 0, economia_pct: 0, descricao: '' });
        }
      });
    });
    req.on('error', () => resolve({ file: p.file, name: p.name, active: p.active, form: p.form, celula: 'OFF', testes: 0, tempo_h: 0, homem_h: 0, maquina_h: 0, economia_pct: 0, descricao: '' }));
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('Analisando', products.length, 'produtos...\n');
  const results = [];
  for (let i = 0; i < products.length; i++) {
    const r = await analyze(products[i]);
    results.push(r);
    if ((i+1) % 10 === 0 || i === products.length - 1) {
      console.log((i+1) + '/' + products.length + '...');
    }
  }

  const withFlow = results.filter(r => r.testes > 0);
  const withCell = results.filter(r => r.celula && r.celula !== '-' && r.celula !== 'DESCONHECIDA');
  
  console.log('\n=== RESUMO FINAL ===');
  console.log('Total: ' + results.length);
  console.log('Com fluxo CQ (BASEFLUXO): ' + withFlow.length);
  console.log('Com célula (MFVCQ): ' + withCell.length);
  
  console.log('\n=== TOP 10 POR TEMPO ===');
  withFlow.sort((a,b) => b.tempo_h - a.tempo_h).slice(0, 10).forEach(r =>
    console.log(r.celula.padEnd(20), r.active.padEnd(20), r.testes + ' testes', r.tempo_h.toFixed(1) + 'h', '(MO:' + r.homem_h.toFixed(1) + 'h)')
  );

  // Group by cell
  console.log('\n=== PRODUTOS POR CÉLULA ===');
  const byCell = {};
  results.forEach(r => { const c = r.celula || '?'; byCell[c] = (byCell[c] || 0) + 1; });
  Object.entries(byCell).sort((a,b) => b[1]-a[1]).forEach(([c,n]) => console.log(c.padEnd(25), n));
  
  // Group by form
  console.log('\n=== POR FORMA ===');
  const byForm = {};
  results.forEach(r => { byForm[r.form] = (byForm[r.form] || 0) + 1; });
  Object.entries(byForm).forEach(([f,n]) => console.log(f.padEnd(15), n));

  fs.writeFileSync('output-teste/batch_results.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('\nSaved to output-teste/batch_results.json');
}

run().catch(console.error);
