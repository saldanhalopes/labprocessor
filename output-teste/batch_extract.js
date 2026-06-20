const fs = require('fs');
const dir = 'docs/Métodos cali';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));

const products = files.map(f => {
  let name = f.replace(/^(PT-|PT |INSTRUCTIVO DE ANÁLISIS DE PRODUCTO TERMINADO |Instructivo de Análisis de Producto Terminado |INSTRUCTIVO DE ANÁLISIS PT-|CLST\d+_)/i, '').replace(/\.pdf$/i, '').trim();
  const un = name.toUpperCase();
  let form = 'Desconhecido';
  if (un.includes('COMPR') || un.includes('TABLETA') || un.includes('TABLETAS') || un.includes('CAPSULA') || un.includes('CÁPSULA') || un.includes('GRAGEA')) form = 'Sólidos';
  else if (un.includes('JARABE') || un.includes('SUSP') || un.includes('SOLUC') || un.includes('GOTAS') || un.includes('ELIXIR') || un.includes('SOLUCI')) form = 'Líquidos';
  else if (un.includes('POLVO') || un.includes('GRANULADO')) form = 'Sólidos';
  let active = name.split(/[\s\-\/]+/).filter(w => w.length > 2)[0] || name;
  return { file: f, name, active, form };
});

fs.writeFileSync('output-teste/batch_products.json', JSON.stringify(products, null, 2), 'utf-8');
console.log('Total:', products.length);
products.forEach(p => console.log(p.form.substring(0,8).padEnd(10), p.active.padEnd(30), p.name.substring(0,60)));
