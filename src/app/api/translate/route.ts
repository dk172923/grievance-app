import { NextRequest, NextResponse } from 'next/server';
import { translateTamilToEnglishServerSide } from '../../../lib/ai-utils-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, from, to } = body;
    
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (from === 'ta' && to === 'en') {
      const translatedText = await translateTamilToEnglishServerSide(text);
      return NextResponse.json({ 
        success: true, 
        translatedText 
      });
    } else {
      return NextResponse.json({ 
        error: 'Unsupported language pair. Only Tamil to English is supported.' 
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to translate text' },
      { status: 500 }
    );
  }
} 