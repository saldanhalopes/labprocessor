import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyA0Khgn9XNFq1iH9_DURmmnukUJ67SJoKA";

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await response.json();
    const models = data.models || [];
    const filtered = models.filter(m => m.name.includes('models/gemini-'));
    console.log('Gemini Models found:', filtered.map(m => m.name).join(', '));
  } catch (err) {
    console.error('Failed to list models:', err);
  }
}

listModels();
