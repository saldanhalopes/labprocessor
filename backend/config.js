import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getApiKey() {
  return process.env.OPENROUTER_API_KEY || '';
}

export function updateApiKey(key) {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  if (content.includes('OPENROUTER_API_KEY=')) {
    content = content.replace(/OPENROUTER_API_KEY=.*/g, `OPENROUTER_API_KEY=${key}`);
  } else {
    content += `\nOPENROUTER_API_KEY=${key}\n`;
  }

  fs.writeFileSync(envPath, content, 'utf-8');
  process.env.OPENROUTER_API_KEY = key;
  console.log('[Config] OpenRouter API Key updated.');
}
