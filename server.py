from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from analyze_priority import analyze_priority

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
)

class PriorityInput(BaseModel):
    description: str
    document_text: str = ""

@app.post("/api/analyze-priority")
async def analyze_priority_endpoint(input: PriorityInput):
    try:
        # Validate description
        if not input.description or len(input.description.strip()) == 0:
            print("Empty or invalid description, returning Medium priority")
            return {"priority": "Medium"}

        # Combine description and document_text (if provided)
        combined_text = input.description
        if input.document_text and input.document_text.strip():
            combined_text += "\n" + input.document_text

        # Analyze priority
        priority = analyze_priority(combined_text)
        print(f"Analyzed priority: {priority} for text: {combined_text[:100]}...")
        return {"priority": priority}
    except Exception as e:
        print(f"Error analyzing priority: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error analyzing priority: {str(e)}")