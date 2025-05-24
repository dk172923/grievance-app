from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
import torch
import re

def analyze_priority(text: str) -> str:
    """
    Analyze text using a fine-tuned DistilBERT model to assign priority: High, Medium, or Low.
    Includes a keyword-based heuristic for death-related grievances as a fallback.
    """
    print("In the analyze_priority function: ", text[:100], "...")
    print("Type of text: ", type(text))
    if not text or len(text.strip()) == 0:
        print("Empty text input, returning Medium priority")
        return "Medium"

    # Keyword-based heuristic for high-priority (death-related) grievances
    high_priority_keywords = [
        r'\bdeath\b', r'\bfatal\b', r'\bkilled\b', r'\bdeceased\b', 
        r'\bfatality\b', r'\bloss of life\b', r'\bmortal\b'
    ]
    for keyword in high_priority_keywords:
        if re.search(keyword, text.lower()):
            print(f"High-priority keyword detected: {keyword}, assigning High priority")
            return "High"

    # Load fine-tuned model and tokenizer
    model_path = './grievance_priority_model'
    try:
        tokenizer = DistilBertTokenizer.from_pretrained(model_path)
        model = DistilBertForSequenceClassification.from_pretrained(model_path)
    except Exception as e:
        print(f"Error loading model: {str(e)}, falling back to Medium priority")
        return "Medium"

    # Tokenize input
    try:
        inputs = tokenizer(text, padding=True, truncation=True, max_length=128, return_tensors="pt")
    except Exception as e:
        print(f"Error tokenizing input: {str(e)}, falling back to Medium priority")
        return "Medium"

    # Predict
    model.eval()
    try:
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            probabilities = torch.softmax(logits, dim=1).tolist()[0]
            predicted_class = torch.argmax(logits, dim=1).item()

        # Log detailed prediction info
        label_map = {0: "High", 1: "Medium", 2: "Low"}
        print(f"Text: {text[:100]}..., Logits: {logits.tolist()[0]}, Probabilities: {probabilities}, Predicted class: {predicted_class}, Priority: {label_map[predicted_class]}")
        
        return label_map[predicted_class]
    except Exception as e:
        print(f"Error during prediction: {str(e)}, falling back to Medium priority")
        return "Medium"