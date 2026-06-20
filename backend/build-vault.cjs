const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');
const DEMANDA = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference', 'demanda_estruturada.json'), 'utf-8'));
const BASEFLUXO = JSON.parse(fs.readFileSync(path.join(ROOT, 'reference', 'basefluxo_estruturado.json'), 'utf-8'));

function sanitize(name) {
  return (name || '').replace(/[<>:"/\\|?*]/g, '-').trim() || 'sem-nome';
}

function wikilink(text) {
  return `[[${sanitize(text)}]]`;
}

function fm(obj) {
  let yaml = '---\n';
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) { yaml += `${k}: []\n`; }
      else {
        yaml += `${k}:\n`;
        v.forEach(item => yaml += `  - ${item}\n`);
      }
    } else if (typeof v === 'string') {
      yaml += v.includes(':') ? `${k}: "${v}"\n` : `${k}: ${v}\n`;
    } else {
      yaml += `${k}: ${v}\n`;
    }
  }
  yaml += '---\n';
  return yaml;
}

// ============================================================
// 1. CELULAS
// ============================================================
console.log('Generating Celulas...');
const celulaGroups = {};
DEMANDA.forEach(p => {
  const c = p.celula || 'DESCONHECIDA';
  if (!celulaGroups[c]) celulaGroups[c] = [];
  celulaGroups[c].push(p);
});

Object.entries(celulaGroups).forEach(([celula, ps]) => {
  const produtos = ps.map(p => wikilink(`${p.codigo_pa}`));
  const ativos = [...new Set(ps.map(p => p.ativo).filter(Boolean))];
  const demandaTotal = ps.reduce((s, p) => s + (p.media_12_meses || 0), 0);
  const formas = ps.map(p => {
    const d = (p.descricao || '').toUpperCase();
    if (d.includes('COMP') || d.includes('CPR') || d.includes('CAP') || d.includes('DRG')) return 'Sólidos';
    if (d.includes('INJ')) return 'Injetáveis';
    if (d.includes('SUS') || d.includes('XAR')) return 'Líquidos';
    return 'Outros';
  });
  const formaPrincipal = [...new Set(formas)].sort((a,b) => formas.filter(f=>f===b).length - formas.filter(f=>f===a).length)[0];

  fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Celulas', `${sanitize(celula)}.md`), 
    fm({
      nome: celula,
      tipo: formaPrincipal,
      produtos: ps.length,
      ativos: ativos.length,
      demanda_total: Math.round(demandaTotal * 100) / 100,
      tags: ['celula', formaPrincipal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
    }) +
    `# ${celula}\n\n` +
    `**Tipo principal:** ${formaPrincipal}\n` +
    `**Produtos:** ${ps.length} | **Ativos:** ${ativos.length}\n` +
    `**Demanda total:** ${Math.round(demandaTotal).toLocaleString()} und/mês\n\n` +
    `## Ativos\n${ativos.slice(0,30).map(a => '- ' + wikilink(a)).join('\n')}\n` +
    (ativos.length > 30 ? `\n... +${ativos.length - 30} mais\n` : '') +
    `\n## Produtos (${ps.length})\n${produtos.slice(0,50).join(', ')}\n`
  );
});
console.log(`  ${Object.keys(celulaGroups).length} celulas`);

// ============================================================
// 2. ATIVOS
// ============================================================
console.log('Generating Ativos...');
const ativoGroups = {};
DEMANDA.forEach(p => {
  const a = p.ativo || 'DESCONHECIDO';
  if (!ativoGroups[a]) ativoGroups[a] = [];
  ativoGroups[a].push(p);
});

Object.entries(ativoGroups).forEach(([ativo, ps]) => {
  const celulas = [...new Set(ps.map(p => p.celula).filter(Boolean))];
  const demandaTotal = ps.reduce((s, p) => s + (p.media_12_meses || 0), 0);
  const bulkMax = Math.max(...ps.map(p => p.tamanho_bulk || 0));
  
  fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Ativos', `${sanitize(ativo)}.md`),
    fm({
      ativo,
      produtos: ps.length,
      celulas,
      demanda_total: Math.round(demandaTotal * 100) / 100,
      bulk_maximo: Math.round(bulkMax),
      tags: ['ativo', ...celulas.map(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).filter(c => c.length > 1)]
    }) +
    `# ${ativo}\n\n` +
    `**Produtos:** ${ps.length}\n` +
    `**Células:** ${celulas.join(', ')}\n` +
    `**Demanda total:** ${Math.round(demandaTotal).toLocaleString()} und/mês\n` +
    `**Maior bulk:** ${Math.round(bulkMax).toLocaleString()} und\n\n` +
    `## Produtos\n${ps.map(p => `- ${wikilink(`${p.codigo_pa}`)} — ${p.descricao || ''} (${p.celula || '?'})`).join('\n')}\n`
  );
});
console.log(`  ${Object.keys(ativoGroups).length} ativos`);

// ============================================================
// 3. PRODUTOS
// ============================================================
console.log('Generating Produtos...');
DEMANDA.forEach(p => {
  fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Produtos', `${sanitize(String(p.codigo_pa))}.md`),
    fm({
      codigo_pa: p.codigo_pa,
      codigo_bulk: p.codigo_bulk,
      descricao: p.descricao,
      ativo: p.ativo,
      celula: p.celula,
      analise_cq: p.analise_cq,
      demanda_media: Math.round((p.media_12_meses || 0) * 100) / 100,
      fator_conversao: p.fator_conversao,
      tamanho_bulk: p.tamanho_bulk,
      demanda_lotes: Math.round((p.demanda_lotes || 0) * 100) / 100,
      tags: ['produto', (p.celula || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
    }) +
    `# ${p.codigo_pa || '?'} — ${p.descricao || 'Sem descrição'}\n\n` +
    `**Ativo:** ${wikilink(p.ativo)}\n` +
    `**Célula:** ${wikilink(p.celula)}\n` +
    `**Análise CQ:** ${p.analise_cq || '-'}\n` +
    `**Demanda média:** ${Math.round(p.media_12_meses || 0).toLocaleString()} und/mês\n` +
    `**Fator conversão:** ${p.fator_conversao || 1}\n` +
    `**Tamanho bulk:** ${Math.round(p.tamanho_bulk || 0).toLocaleString()} und\n` +
    `**Demanda em lotes:** ${Math.round((p.demanda_lotes || 0) * 100) / 100}/mês\n`
  );
});
console.log(`  ${DEMANDA.length} produtos`);

// ============================================================
// 4. TESTES (from BASEFLUXO)
// ============================================================
console.log('Generating Testes...');
const tests = {};
Object.values(BASEFLUXO).forEach(ativo => {
  Object.values(ativo).forEach(forma => {
    Object.entries(forma).forEach(([teste, atividades]) => {
      if (teste === 'TESTE' || teste === 'FORMA FARMACÊUTICA') return;
      if (!tests[teste] && atividades.length > 0) {
        const rotas = [...new Set(atividades.map(a => a.rota))];
        const fixas = atividades.filter(a => a.padrao_amostra === 'Padrão');
        const vars = atividades.filter(a => a.padrao_amostra === 'Amostra');
        const totalFixo = fixas.reduce((s, a) => s + (a.tempo_corrida_minutos || 0), 0);
        const totalVar = vars.reduce((s, a) => s + (a.tempo_corrida_minutos || 0), 0);
        const moTotal = atividades.filter(a => a.execucao === 'MO').reduce((s, a) => s + (a.tempo_corrida_minutos || 0), 0);
        const total = totalFixo + totalVar;

        // Generate aliases
        const aliases = [teste];
        const t = teste.toUpperCase();
        if (t.includes('TEOR') || t.includes('HPLC') && !t.includes('DEGRAD') && !t.includes('DISSOLU'))
          aliases.push('Doseamento HPLC', 'Assay HPLC', 'Teor HPLC', 'Dosagem HPLC');
        if (t.includes('DEGRAD'))
          aliases.push('Degradação HPLC', 'Impurezas', 'Substâncias Relacionadas', 'Related Substances');
        if (t.includes('DISSOLU'))
          aliases.push('Dissolução', 'Dissolution');
        if (t.includes('DESINTEGR') && !t.includes('DISSOLU'))
          aliases.push('Desintegração', 'Disintegration');
        if (t.includes('DUREZA') && !t.includes('UNIFORMIDADE'))
          aliases.push('Dureza', 'Hardness');
        if (t.includes('PESO') && t.includes('MEDIO'))
          aliases.push('Peso Médio', 'Average Weight');
        if (t.includes('UMIDADE'))
          aliases.push('Umidade', 'Karl Fischer', 'Água', 'Water Content', 'Moisture');
        if (t.includes('UNIFORMIDADE'))
          aliases.push('Uniformidade', 'Variação de Peso', 'Content Uniformity');
        if (t.includes('FRACIONAMENTO'))
          aliases.push('Fracionamento', 'Sample Fractioning');
        if (t.includes('SEPARA'))
          aliases.push('Separação de Amostras');
        if (t.includes('MOVIMENTADOR'))
          aliases.push('Movimentador', 'Sample Handling');

        const mpct = Math.round(moTotal / total * 100);
        tests[teste] = { teste, rotas, totalFixo, totalVar, total, moTotal, moPct: mpct, aliases: [...new Set(aliases)] };

        fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Testes', `${sanitize(teste)}.md`),
          fm({
            teste,
            tecnica: t.includes('HPLC') ? 'HPLC' : t.includes('DISSOLUTOR') ? 'Dissolução' : t.includes('DESINTEGRADOR') ? 'Desintegração' : 'Físico',
            categoria: 'Físico-Químico',
            forma: 'Sólidos',
            aliases: [...new Set(aliases)],
            rotas,
            atividades: atividades.length,
            fixo_min: Math.round(totalFixo * 100) / 100,
            var_min: Math.round(totalVar * 100) / 100,
            total_min: Math.round(total * 100) / 100,
            mo_pct: Math.round(moTotal / total * 100),
            tags: aliases.slice(0,8).map(a => a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')),
            status: 'completo'
          }) +
          `# ${teste}\n\n` +
          `**Técnica:** ${t.includes('HPLC') ? 'HPLC' : t.includes('DISSOLU') ? 'Dissolução' : t.includes('DESINTEGR') ? 'Desintegração' : t.includes('DUREZA') ? 'Dureza' : 'Físico'}\n` +
          `**Rotas:** ${rotas.map(r => wikilink(r)).join(', ')}\n\n` +
          `**Tempo total:** ${(total / 60).toFixed(1)}h por lote\n` +
          `**Fixo (calibração):** ${(totalFixo / 60).toFixed(1)}h | **Variável (amostra):** ${(totalVar / 60).toFixed(1)}h\n` +
          `**MO (analista):** ${mpct}% | **MAQ (máquina):** ${100 - mpct}%\n\n` +
          `**Aliases:** ${aliases.join(', ')}\n`
        );
      }
    });
  });
});
console.log(`  ${Object.keys(tests).length} testes`);

// ============================================================
// 5. ROTAS
// ============================================================
console.log('Generating Rotas...');
const routes = new Set();
Object.values(BASEFLUXO).forEach(ativo => {
  Object.values(ativo).forEach(forma => {
    Object.values(forma).forEach(atividades => {
      if (!Array.isArray(atividades)) return;
      atividades.forEach(a => {
        if (a.rota && a.rota !== 'ROTA' && !routes.has(a.rota)) {
          routes.add(a.rota);
          const ativs = atividades.filter(x => x.rota === a.rota);
          const mo = ativs.filter(x => x.execucao === 'MO').reduce((s, x) => s + (x.tempo_corrida_minutos || 0), 0);
          const maq = ativs.filter(x => x.execucao === 'MAQ').reduce((s, x) => s + (x.tempo_corrida_minutos || 0), 0);
          const tipo = mo > maq ? 'Analista' : 'Máquina';
          fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Rotas', `${sanitize(a.rota)}.md`),
            fm({
              rota: a.rota,
              tipo,
              execucao: mo > maq ? 'MO' : 'MAQ',
              atividades: ativs.length,
              tempo_mo: Math.round(mo * 100) / 100,
              tempo_maq: Math.round(maq * 100) / 100,
              tags: ['rota', tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), a.rota.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-')]
            }) +
            `# ${a.rota}\n\n` +
            `**Tipo:** ${tipo}\n` +
            `**MO:** ${mo.toFixed(1)}min | **MAQ:** ${maq.toFixed(1)}min\n` +
            `**Atividades:** ${ativs.length}\n`
          );
        }
      });
    });
  });
});
console.log(`  ${routes.size} rotas`);

// ============================================================
// 6. MATRIZ.md
// ============================================================
console.log('Generating Matriz...');
let matriz = '# Matriz: Produtos × Testes × Rotas\n\n';
matriz += '| Código | Produto | Ativo | Célula | Demanda | Lotes |\n';
matriz += '|--------|---------|-------|--------|---------|--------|\n';
DEMANDA.slice(0, 100).forEach(p => {
  matriz += `| ${p.codigo_pa} | ${(p.descricao || '').substring(0,40)} | ${wikilink(p.ativo)} | ${wikilink(p.celula)} | ${Math.round(p.media_12_meses || 0)} | ${Math.round((p.demanda_lotes || 0) * 100) / 100} |\n`;
});
if (DEMANDA.length > 100) matriz += `| ... | +${DEMANDA.length - 100} produtos | | | | |\n`;
fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Matriz.md'), matriz);
console.log('  Matriz.md');

// ============================================================
// 7. TEMPLATES
// ============================================================
fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Templates', 'Novo Teste.md'),
  `---
teste: ""
tecnica: ""
categoria: ""
forma: ""
aliases: []
tags: []
rotas: []
mo_pct: 0
fixo_min: 0
var_min: 0
total_min: 0
status: stub
produto_origem: ""
criado: ${new Date().toISOString().split('T')[0]}
---

# Novo Teste

⚠️ **STUB** — Preencher as informações abaixo.

**Técnica:** 
**Origem:** 
**Produto de origem:** [[]]

**Rotas necessárias:**
- [ ] 
- [ ] 

**Produtos que usam este teste:**
- 
`);
fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'Templates', 'Nova Rota.md'),
  `---
rota: ""
tipo: ""
execucao: ""
atividades: 0
tempo_mo: 0
tempo_maq: 0
tags: []
---

# Nova Rota

**Tipo:** (Analista / Máquina)
**Execução:** (MO / MAQ)
**Tempo MO:** min
**Tempo MAQ:** min
**Atividades típicas:**
- 
`);
console.log('  Templates');

// ============================================================
// 8. BEM_VINDO.md
// ============================================================
fs.writeFileSync(path.join(KNOWLEDGE_DIR, 'BEM_VINDO.md'),
  `# Vault LabProcessor — Conhecimento de CQ Farmacêutico

## Estrutura

| Pasta | Notas | Descrição |
|-------|-------|-----------|
| [[Celulas/]] | ${Object.keys(celulaGroups).length} | Células de produção |
| [[Ativos/]] | ${Object.keys(ativoGroups).length} | Princípios ativos |
| [[Produtos/]] | ${DEMANDA.length} | Produtos acabados |
| [[Testes/]] | ${Object.keys(tests).length} | Testes de CQ com rotas |
| [[Rotas/]] | ${routes.size} | Equipamentos e funções |
| [[Matriz]] | 1 | Tabela central |
| [[Templates/]] | 2 | Templates para novos itens |

## Como usar

1. Navegue entre as notas usando \`[[wikilinks]]\`
2. Cada teste tem suas **rotas** e **aliases**
3. Cada produto tem seu **ativo** e **célula**
4. Use a [[Matriz]] para visão geral (Dataview)

## Atualização automática

Este vault é gerado e atualizado pelo \`build-vault.js\`. 
Novas notas stub são criadas quando a IA encontra um teste desconhecido.
`);
console.log('  BEM_VINDO.md');

// ============================================================
// FINAL
// ============================================================
const totalFiles = Object.keys(celulaGroups).length + Object.keys(ativoGroups).length + DEMANDA.length + Object.keys(tests).length + routes.size + 4;
console.log(`\nVault gerado: ${totalFiles} arquivos em backend/knowledge/`);
console.log(`  Celulas: ${Object.keys(celulaGroups).length}`);
console.log(`  Ativos: ${Object.keys(ativoGroups).length}`);
console.log(`  Produtos: ${DEMANDA.length}`);
console.log(`  Testes: ${Object.keys(tests).length}`);
console.log(`  Rotas: ${routes.size}`);
console.log(`  Templates: 2 | Matriz: 1 | BEM_VINDO: 1`);
