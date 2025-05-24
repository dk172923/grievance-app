// Browser-safe utilities for client-side use. All server-side processing is handled via API calls.

export async function analyzePriority(input: { description: string; document_text?: string }): Promise<'Low' | 'Medium' | 'High'> {
  try {
    // Validate inputs
    if (typeof input.description !== 'string' || !input.description.trim()) {
      console.warn('Invalid or empty description, defaulting to Medium priority');
      return 'Medium';
    }
    const documentText = typeof input.document_text === 'string' ? input.document_text : '';

    const response = await fetch('http://localhost:8000/api/analyze-priority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: input.description,
        document_text: documentText,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    console.log('FastAPI priority response:', data);
    return data.priority as 'Low' | 'Medium' | 'High';
  } catch (error) {
    console.error('Error analyzing priority:', error);
    return 'Medium'; // Fallback
  }
}

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

export async function translateTamilToEnglish(text: string): Promise<string> {
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
  } catch (error) {
    console.error('Translation error:', error);
    return 'Translation failed. Original text: ' + text;
  }
}

export {};