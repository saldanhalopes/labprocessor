import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = "AIzaSyA0Khgn9XNFq1iH9_DURmmnukUJ67SJoKA";

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // The SDK might not have a direct listModels, but we can try a fetch
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await response.json();
    console.log('Available Models:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to list models:', err);
  }
}

listModels();
