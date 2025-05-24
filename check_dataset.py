import pandas as pd

# Load dataset
df = pd.read_csv('grievance_dataset.csv')

# Print label distribution
print("Label distribution:")
print(df['label'].value_counts())

# Print sample counts
total = len(df)
print(f"\nTotal records: {total}")
for label, count in df['label'].value_counts().items():
    print(f"{label}: {count} ({count/total:.2%})")

# Check sample examples
print("\nSample examples per label:")
for label in df['label'].unique():
    print(f"\nLabel: {label}")
    print(df[df['label'] == label]['text'].head(3).to_list())