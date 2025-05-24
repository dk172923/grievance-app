import { NextRequest, NextResponse } from 'next/server';
import { analyzeDocumentServerSide } from '../../../lib/ai-utils-server';

export async function POST(req: NextRequest) {
  try {
    console.log("Analyze document API route called");
    
    // Get form data directly from the request
    const formData = await req.formData();
    console.log("Form data received");
    
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error("No file provided in form data");
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    console.log(`File received: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`Buffer created with size: ${buffer.length} bytes`);
    
    const mimetype = file.type;
    console.log(`MIME type: ${mimetype}`);
    
    // Process the document
    console.log("Calling analyzeDocumentServerSide...");
    const result = await analyzeDocumentServerSide(buffer, mimetype);
    console.log("Document analysis completed");
    
    if (result.error) {
      console.error(`Error from document analysis: ${result.error}`);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    console.log("Returning successful response");
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in document analysis API route:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'Failed to analyze document.' 
    }, { status: 500 });
  }
} 