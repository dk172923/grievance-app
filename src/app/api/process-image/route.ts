import { NextRequest, NextResponse } from 'next/server';
import { processImageBuffer } from '../../../lib/ai-utils-server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Process image (simplified without sharp)
    const processedBuffer = await processImageBuffer(buffer);

    // Return the processed image as base64
    const base64Image = processedBuffer.toString('base64');
    const mimeType = file.type || 'image/png';
    
    return NextResponse.json({ 
      success: true, 
      data: `data:${mimeType};base64,${base64Image}` 
    });
  } catch (error: any) {
    console.error('Error processing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process image' },
      { status: 500 }
    );
  }
} 