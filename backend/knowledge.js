import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DIR = path.join(__dirname, 'knowledge');

let vaultCache = null;

function normalize(text) {
  return (text || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove accents
    .replace(/[^A-Z0-9\s]/g, ' ')     // remove special chars
    .replace(/\s+/g, ' ')             // collapse spaces
    .trim();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const yaml = match[1];
  const data = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of yaml.split('\n')) {
    const arrMatch = line.match(/^\s*-\s+(.+)/);
    if (arrMatch && currentArray !== null) {
      data[currentArray].push(arrMatch[1].replace(/^"|"$/g, '').trim());
      continue;
    }
    const kvMatch = line.match(/^([a-z_]+):\s*(.*)/i);
    if (kvMatch) {
      currentKey = kvMatch[1];
      currentArray = null;
      let val = kvMatch[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val === '') { data[currentKey] = []; currentArray = currentKey; }
      else if (val === 'true') data[currentKey] = true;
      else if (val === 'false') data[currentKey] = false;
      else if (!isNaN(Number(val)) && val !== '') data[currentKey] = Number(val);
      else data[currentKey] = val;
    }
  }
  return data;
}

export function loadVault() {
  if (vaultCache) return vaultCache;

  const testsDir = path.join(VAULT_DIR, 'Testes');
  const produtosDir = path.join(VAULT_DIR, 'Produtos');
  const ativosDir = path.join(VAULT_DIR, 'Ativos');
  const celulasDir = path.join(VAULT_DIR, 'Celulas');

  const tests = [];
  const produtos = [];
  const ativos = [];
  const celulas = [];

  if (fs.existsSync(testsDir)) {
    fs.readdirSync(testsDir).filter(f => f.endsWith('.md')).forEach(f => {
      const content = fs.readFileSync(path.join(testsDir, f), 'utf-8');
      const fm = parseFrontmatter(content);
      tests.push({ ...fm, filename: f });
    });
  }

  if (fs.existsSync(produtosDir)) {
    fs.readdirSync(produtosDir).filter(f => f.endsWith('.md')).forEach(f => {
      const content = fs.readFileSync(path.join(produtosDir, f), 'utf-8');
      produtos.push(parseFrontmatter(content));
    });
  }

  if (fs.existsSync(ativosDir)) {
    fs.readdirSync(ativosDir).filter(f => f.endsWith('.md')).forEach(f => {
      const content = fs.readFileSync(path.join(ativosDir, f), 'utf-8');
      ativos.push(parseFrontmatter(content));
    });
  }

  if (fs.existsSync(celulasDir)) {
    fs.readdirSync(celulasDir).filter(f => f.endsWith('.md')).forEach(f => {
      const content = fs.readFileSync(path.join(celulasDir, f), 'utf-8');
      celulas.push(parseFrontmatter(content));
    });
  }

  vaultCache = { tests, produtos, ativos, celulas };
  console.log(`[Knowledge] Vault loaded: ${tests.length} tests, ${produtos.length} products, ${ativos.length} ativos`);
  return vaultCache;
}

export function findSimilar(geminiTestName) {
  const vault = loadVault();
  const q = normalize(geminiTestName);
  const qWords = q.split(/\s+/).filter(w => w.length > 1);

  if (!qWords.length) return null;

  let best = null;
  let bestScore = 0;

  for (const t of vault.tests) {
    if (t.status === 'stub') continue;
    const aliases = (t.aliases || []).map(a => normalize(a));
    let score = 0;

    // Exact alias match
    if (aliases.some(a => a === q)) {
      score = 100;
    }
    // Alias contained in query or vice versa
    else if (aliases.some(a => q.includes(a) || a.includes(q))) {
      const matchLen = Math.max(...aliases.map(a => q.includes(a) ? a.length : 0));
      score = 70 + Math.min(25, matchLen / q.length * 25);
    }
    // Word-level overlap
    else {
      let aliasHits = 0;
      for (const alias of aliases) {
        const aWords = alias.split(/\s+/).filter(w => w.length > 1);
        const matches = aWords.filter(aw => qWords.some(qw => qw.includes(aw) || aw.includes(qw)));
        aliasHits = Math.max(aliasHits, matches.length / Math.max(1, aWords.length));
      }
      score = Math.round(aliasHits * 60);
    }

    // Penalize if test and query have different primary techniques
    if (score > 30) {
      const isHPLC = q.includes('HPLC') || q.includes('CROMATO');
      const isDissol = q.includes('DISSOL');
      const tName = normalize(t.teste);
      if ((isHPLC && !tName.includes('HPLC') && !tName.includes('DEGRAD'))
        || (isDissol && !tName.includes('DISSOL')))
        score *= 0.5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }

  return bestScore >= 40 ? { ...best, score: bestScore } : null;
}

export function getTestByName(teste) {
  const vault = loadVault();
  return vault.tests.find(t => t.teste === teste) || null;
}

export function getTestRotas(teste) {
  const test = getTestByName(teste);
  return test?.rotas || [];
}

export function getProductInfo(codigoPa) {
  const vault = loadVault();
  return vault.produtos.find(p => p.codigo_pa === codigoPa) || null;
}

export function getAtivoInfo(nome) {
  const vault = loadVault();
  if (!nome) return null;
  const n = normalize(nome);
  return vault.ativos.find(a => normalize(a.ativo).includes(n)) || null;
}

export function getCelulaInfo(nome) {
  const vault = loadVault();
  if (!nome) return null;
  const n = normalize(nome);
  return vault.celulas.find(c => normalize(c.nome).includes(n)) || null;
}

export function createStub({ testName, technique, productName }) {
  const sanitized = testName.replace(/[<>:"/\\|?*]/g, '-').trim();
  const filePath = path.join(VAULT_DIR, 'Testes', `${sanitized}.md`);

  if (fs.existsSync(filePath)) return null;

  const content = `---
teste: "${testName}"
tecnica: "${technique || 'Desconhecida'}"
categoria: ""
forma: ""
aliases: [${[testName, technique].filter(Boolean).map(x => `"${x}"`).join(', ')}]
tags: []
rotas: []
mo_pct: 0
fixo_min: 0
var_min: 0
total_min: 0
status: stub
produto_origem: "${productName || 'Desconhecido'}"
criado: ${new Date().toISOString().split('T')[0]}
---

# ${testName}

⚠️ **STUB** — Esta nota foi gerada automaticamente e precisa de curadoria.

**Técnica:** ${technique || 'Desconhecida'}
**Origem:** Extraído do PDF importado
**Produto de origem:** ${productName || 'Desconhecido'}

**Rotas necessárias (a preencher):**
- [ ] 
- [ ] 

**Produtos que usam este teste:**
- 
`;

  fs.writeFileSync(filePath, content, 'utf-8');

  // Invalidate cache
  vaultCache = null;
  console.log(`[Knowledge] Stub created: ${testName}`);
  return { status: 'stub', teste: testName };
}

export function getVaultStats() {
  const vault = loadVault();
  return {
    tests: vault.tests.length,
    products: vault.produtos.length,
    ativos: vault.ativos.length,
    celulas: vault.celulas.length,
    stubs: vault.tests.filter(t => t.status === 'stub').length
  };
}
