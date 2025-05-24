
import pandas as pd
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification, Trainer, TrainingArguments
from datasets import Dataset
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score
import numpy as np

# Load and augment dataset
df = pd.read_csv('grievance_dataset.csv')
label_map = {'High': 0, 'Medium': 1, 'Low': 2}
df['label'] = df['label'].map(label_map)

# Augment all classes
augmented_examples = [
    # High priority
    {"text": "Water contamination in JKL Colony killed seven residents, including children, on May 15, 2025.", "label": 0},
    {"text": "Roof collapse at GHI School caused the death of a student and injured three others.", "label": 0},
    {"text": "Sewage overflow in MNO Village led to fatal infections, killing five people.", "label": 0},
    {"text": "Chemical spill in PQR Factory caused fatalities among workers on May 10, 2025.", "label": 0},
    # Medium priority
    {"text": "Leaking roof in DEF School classroom in Tiruchirappalli disrupts classes during monsoon.", "label": 1},
    {"text": "Broken desks in VWX School, Madurai, cause discomfort but classes continue.", "label": 1},
    {"text": "Overcrowded classrooms in YZ School, Chennai, lead to minor learning disruptions.", "label": 1},
    {"text": "Faulty electrical wiring in UVW School, Coimbatore, requires repair but no immediate danger.", "label": 1},
    # Low priority
    {"text": "Faded paint in MNO School corridors in Salem affects aesthetics but not functionality.", "label": 2},
    {"text": "Graffiti on STU School walls in Erode needs cleaning for better appearance.", "label": 2},
    {"text": "Worn-out playground equipment in QRS School, Salem, is outdated but safe.", "label": 2},
    {"text": "Minor landscaping issues in XYZ School, Madurai, affect school appearance.", "label": 2},
]
augmented_df = pd.concat([df, pd.DataFrame(augmented_examples)], ignore_index=True)

# Split dataset
train_df, eval_df = train_test_split(augmented_df, test_size=0.2, stratify=augmented_df['label'], random_state=42)
train_dataset = Dataset.from_pandas(train_df)
eval_dataset = Dataset.from_pandas(eval_df)

# Tokenizer
tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')

def tokenize_function(examples):
    return tokenizer(examples['text'], padding=True, truncation=True, max_length=128)

train_dataset = train_dataset.map(tokenize_function, batched=True)
eval_dataset = eval_dataset.map(tokenize_function, batched=True)

# Model
model = DistilBertForSequenceClassification.from_pretrained('distilbert-base-uncased', num_labels=3)

# Training arguments
training_args = TrainingArguments(
    output_dir='./grievance_priority_model',
    num_train_epochs=3,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    warmup_steps=100,
    weight_decay=0.01,
    logging_dir='./logs',
    logging_steps=20,
    evaluation_strategy='steps',
    eval_steps=100,
    save_strategy='steps',
    save_steps=100,
    load_best_model_at_end=True,
    metric_for_best_model='f1',
    greater_is_better=True,
)

# Custom metric (F1-score)
def compute_metrics(p):
    predictions = p.predictions.argmax(-1)
    labels = p.label_ids
    f1 = f1_score(labels, predictions, average='weighted')
    accuracy = (predictions == labels).mean()
    return {"accuracy": accuracy, "f1": f1}

# Trainer
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    compute_metrics=compute_metrics,
)

# Train
trainer.train()

# Save model
model.save_pretrained('./grievance_priority_model')
tokenizer.save_pretrained('./grievance_priority_model')

print("Model training completed and saved to ./grievance_priority_model")














# import pandas as pd
# from transformers import DistilBertTokenizer, DistilBertForSequenceClassification, Trainer, TrainingArguments
# from datasets import Dataset
# import torch
# from sklearn.model_selection import train_test_split
# from sklearn.metrics import f1_score
# import numpy as np

# # Load dataset
# df = pd.read_csv('grievance_dataset_generated.csv')

# # Map string labels to integers
# label_map = {'High': 0, 'Medium': 1, 'Low': 2}
# df['label'] = df['label'].map(label_map)

# # Augment dataset manually with examples
# augmented_examples = [
#     # High priority
#     {"text": "Water contamination in JKL Colony killed seven residents, including children, on May 15, 2025.", "label": 0},
#     {"text": "Roof collapse at GHI School caused the death of a student and injured three others.", "label": 0},
#     {"text": "Sewage overflow in MNO Village led to fatal infections, killing five people.", "label": 0},
#     {"text": "Chemical spill in PQR Factory caused fatalities among workers on May 10, 2025.", "label": 0},
#     # Medium priority
#     {"text": "Leaking roof in DEF School classroom in Tiruchirappalli disrupts classes during monsoon.", "label": 1},
#     {"text": "Broken desks in VWX School, Madurai, cause discomfort but classes continue.", "label": 1},
#     {"text": "Overcrowded classrooms in YZ School, Chennai, lead to minor learning disruptions.", "label": 1},
#     {"text": "Faulty electrical wiring in UVW School, Coimbatore, requires repair but no immediate danger.", "label": 1},
#     # Low priority
#     {"text": "Faded paint in MNO School corridors in Salem affects aesthetics but not functionality.", "label": 2},
#     {"text": "Graffiti on STU School walls in Erode needs cleaning for better appearance.", "label": 2},
#     {"text": "Worn-out playground equipment in QRS School, Salem, is outdated but safe.", "label": 2},
#     {"text": "Minor landscaping issues in XYZ School, Madurai, affect school appearance.", "label": 2},
# ]
# augmented_df = pd.concat([df, pd.DataFrame(augmented_examples)], ignore_index=True)

# # Split dataset
# train_df, eval_df = train_test_split(augmented_df, test_size=0.2, stratify=augmented_df['label'], random_state=42)
# train_dataset = Dataset.from_pandas(train_df)
# eval_dataset = Dataset.from_pandas(eval_df)

# # Load tokenizer
# tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')

# # Tokenization function
# def tokenize_function(examples):
#     return tokenizer(examples['text'], padding='max_length', truncation=True, max_length=128)

# # Apply tokenization
# train_dataset = train_dataset.map(tokenize_function, batched=True)
# eval_dataset = eval_dataset.map(tokenize_function, batched=True)

# # Remove extra columns (keep only inputs required by model)
# columns_to_keep = ['input_ids', 'attention_mask', 'label']
# train_dataset = train_dataset.remove_columns([col for col in train_dataset.column_names if col not in columns_to_keep])
# eval_dataset = eval_dataset.remove_columns([col for col in eval_dataset.column_names if col not in columns_to_keep])

# # Set format for PyTorch
# train_dataset.set_format(type='torch', columns=columns_to_keep)
# eval_dataset.set_format(type='torch', columns=columns_to_keep)

# # Load model
# model = DistilBertForSequenceClassification.from_pretrained('distilbert-base-uncased', num_labels=3)

# # Training arguments
# training_args = TrainingArguments(
#     output_dir='./grievance_priority_model',
#     num_train_epochs=3,
#     per_device_train_batch_size=8,
#     per_device_eval_batch_size=8,
#     warmup_steps=100,
#     weight_decay=0.01,
#     logging_dir='./logs',
#     logging_steps=20,
#     evaluation_strategy='steps',
#     eval_steps=100,
#     save_strategy='steps',
#     save_steps=100,
#     load_best_model_at_end=True,
#     metric_for_best_model='f1',
#     greater_is_better=True,
# )

# # Compute metrics
# def compute_metrics(p):
#     predictions = p.predictions.argmax(-1)
#     labels = p.label_ids
#     f1 = f1_score(labels, predictions, average='weighted')
#     accuracy = (predictions == labels).mean()
#     return {"accuracy": accuracy, "f1": f1}

# # Trainer
# trainer = Trainer(
#     model=model,
#     args=training_args,
#     train_dataset=train_dataset,
#     eval_dataset=eval_dataset,
#     compute_metrics=compute_metrics,
# )

# # Train model
# trainer.train()

# # Save final model and tokenizer
# model.save_pretrained('./grievance_priority_model')
# tokenizer.save_pretrained('./grievance_priority_model')

# print("✅ Model training completed and saved to ./grievance_priority_model")

