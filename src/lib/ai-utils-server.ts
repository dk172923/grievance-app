import { createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

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

  tokens.forEach(token => {
    if (priorityKeywords.high.includes(token)) highScore += 2;
    if (priorityKeywords.medium.includes(token)) mediumScore += 1;
    if (priorityKeywords.low.includes(token)) lowScore += 0.5;
  });

  const sentiment = simpleSentiment(text);
  if (sentiment === 'negative') highScore += 1;
  else if (sentiment === 'positive') lowScore += 0.5;

  const maxScore = Math.max(highScore, mediumScore, lowScore);
  if (maxScore === highScore) return 'High';
  if (maxScore === mediumScore) return 'Medium';
  return 'Low';
}

// Function to perform OCR on an image
async function performOCR(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('eng');
  try {
    const { data: { text } } = await worker.recognize(imageBuffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

// Process image buffer without using sharp
export async function processImageBuffer(buffer: Buffer): Promise<Buffer> {
  // Just return the original buffer since we can't use sharp
  return buffer;
}

// Function to extract text from different file types
async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  switch (mimetype) {
    case 'application/pdf': {
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'image/jpeg':
    case 'image/png': {
      // Use OCR directly without image processing
      return await performOCR(buffer);
    }
    case 'text/plain':
      return buffer.toString('utf-8');
    default:
      throw new Error('Unsupported file type');
  }
}

// Function to analyze document content
export async function analyzeDocumentServerSide(buffer: Buffer, mimetype: string): Promise<{
  summary: string;
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  extractedText: string;
  error?: string;
}> {
  try {
    console.log(`Processing document with mimetype: ${mimetype}, buffer size: ${buffer.length} bytes`);
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty document buffer received');
    }
    
    if (!mimetype) {
      throw new Error('No MIME type specified');
    }
    
    const text = await extractTextFromBuffer(buffer, mimetype);
    console.log(`Extracted text length: ${text.length} characters`);
    
    const keywords = extractKeywords(text);
    const sentiment = simpleSentiment(text);
    const summary = text.slice(0, 100) + '...';
    
    return {
      summary,
      keywords,
      sentiment,
      extractedText: text
    };
  } catch (error: any) {
    console.error('Error analyzing document:', error);
    console.error('Error stack:', error.stack);
    return {
      summary: '',
      keywords: [],
      sentiment: 'neutral',
      extractedText: '',
      error: error.message || 'Failed to analyze document.'
    };
  }
}

// Server-side implementation of Tamil to English translation using an API
export async function translateTamilToEnglishServerSide(text: string): Promise<string> {
  try {
    // Using a public translation API (this is just an example, you would use your own service)
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      body: JSON.stringify({
        q: text,
        source: 'ta',
        target: 'en',
        format: 'text',
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Translation service error');
    }

    const data = await response.json() as { translatedText: string };
    return data.translatedText || '';
  } catch (error) {
    console.error('Translation error:', error);
    return 'Translation failed. ' + text;
  }
}

// Add this at the end of the file for TypeScript module resolution
export {}; 