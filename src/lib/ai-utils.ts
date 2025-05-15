// This file contains browser-safe utilities only. All server-side processing should be handled through API calls.

// If you need browser-safe utilities, add them here. Otherwise, leave this file empty or with only browser-safe exports.

export {};

import { pipeline } from '@xenova/transformers';

let translationPipeline: any = null;

// Simple keyword-based sentiment analysis
const positiveWords = ['good', 'great', 'excellent', 'urgent', 'important', 'resolved', 'help', 'support'];
const negativeWords = ['bad', 'poor', 'critical', 'danger', 'problem', 'issue', 'delay', 'unresolved', 'complaint'];

export function simpleSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  let score = 0;
  for (const word of text.toLowerCase().split(/\W+/)) {
    if (positiveWords.includes(word)) score++;
    if (negativeWords.includes(word)) score--;
  }
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

// Simple TF-IDF-like keyword extraction
export function extractKeywords(text: string, topN = 5): string[] {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

// Priority keywords and their weights
const priorityKeywords = {
  high: ['urgent', 'emergency', 'critical', 'immediate', 'severe', 'serious', 'dangerous', 'life-threatening'],
  medium: ['important', 'significant', 'moderate', 'concern', 'issue', 'problem'],
  low: ['minor', 'slight', 'small', 'trivial', 'non-urgent']
};

// Function to analyze text and assign priority
export async function analyzePriority(text: string): Promise<'Low' | 'Medium' | 'High'> {
  const tokens = text.toLowerCase().split(/\W+/);
  if (!tokens) return 'Medium';

  let highScore = 0;
  let mediumScore = 0;
  let lowScore = 0;

  // Calculate scores based on keyword presence
  tokens.forEach(token => {
    if (priorityKeywords.high.includes(token)) highScore += 2;
    if (priorityKeywords.medium.includes(token)) mediumScore += 1;
    if (priorityKeywords.low.includes(token)) lowScore += 0.5;
  });

  // Calculate sentiment score
  const sentiment = simpleSentiment(text);
  if (sentiment === 'negative') highScore += 1;
  else if (sentiment === 'positive') lowScore += 0.5;

  // Determine priority based on scores
  const maxScore = Math.max(highScore, mediumScore, lowScore);
  if (maxScore === highScore) return 'High';
  if (maxScore === mediumScore) return 'Medium';
  return 'Low';
}

// Function to analyze document content using the server API
export async function analyzeDocument(file: File): Promise<{
  summary: string;
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  extractedText: string;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/analyze-document', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to analyze document');
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing document:', error);
    throw new Error('Failed to analyze document: ' + (error as Error).message);
  }
}

// Process image using server API
export async function processImage(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/process-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to process image');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image: ' + (error as Error).message);
  }
}

// Client-side translation (using WebAssembly transformers.js)
export async function translateTamilToEnglish(text: string): Promise<string> {
  try {
    // Try client-side translation first
    if (!translationPipeline) {
      translationPipeline = await pipeline('translation', 'Helsinki-NLP/opus-mt-ta-en');
    }
    const output = await translationPipeline(text);
    return output[0]?.translation_text || '';
  } catch (error) {
    console.error('Client-side translation failed, using server API:', error);
    // Fall back to server-side translation
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, from: 'ta', to: 'en' }),
      });
      
      if (!response.ok) {
        throw new Error('Translation API error');
      }
      
      const data = await response.json();
      return data.translatedText || '';
    } catch (fallbackError) {
      console.error('Server-side translation also failed:', fallbackError);
      return 'Translation failed. Original text: ' + text;
    }
  }
} 