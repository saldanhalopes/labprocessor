import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __d = path.dirname(fileURLToPath(import.meta.url));

// Backup
const bfPath = path.join(__d, '..', 'backend', 'reference', 'basefluxo_estruturado.json');
const backup = fs.readFileSync(bfPath, 'utf-8');

// Test: manually call addStubToBasfluxo via dynamic import
import { addStubToBasfluxo } from '../backend/learning.js';

console.log('=== Add stub to BASEFLUXO ===');
const result = addStubToBasfluxo('TESTE_NOVO_HPLC', 'HPLC');
console.log('Result:', result);

// Verify
const bf = JSON.parse(fs.readFileSync(bfPath, 'utf-8'));
const entry = bf.Solidos && bf.Solidos['TESTE_NOVO_HPLC'];
if (entry) {
  console.log('Entry created:', entry.length, 'activities');
  entry.forEach(a => console.log('  rota:', a.rota, '| exec:', a.execucao, '| tempo:', a.tempo_corrida_minutos, 'min'));
} else {
  console.log('Entry NOT created');
}

// Check meta
const meta = bf.Solidos._meta['TESTE_NOVO_HPLC'];
console.log('Meta:', meta ? JSON.stringify(meta) : 'NOT FOUND');

// Restore
fs.writeFileSync(bfPath, backup, 'utf-8');
console.log('\nBackup restored.');
