import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyA0Khgn9XNFq1iH9_DURmmnukUJ67SJoKA";

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await response.json();
    const models = data.models || [];
    const filtered = models.filter(m => m.name.includes('1.5-flash') || m.name.includes('1.5-pro'));
    console.log('Filtered Models:', JSON.stringify(filtered, null, 2));
  } catch (err) {
    console.error('Failed to list models:', err);
  }
}

listModels();
