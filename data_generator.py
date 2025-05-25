import pandas as pd
import random
import csv
from faker import Faker
from tqdm import tqdm

fake = Faker('en_IN')  # India-focused data

# 15 categories and templates
categories = {
    "Public Infrastructure": [
        "Collapsed bridge in {location} poses danger to commuters.",
        "Streetlights not working in {location} for the past {days} days.",
        "Potholes on main road near {location} causing traffic jams.",
    ],
    "Utilities": [
        "No electricity supply in {location} for over {days} hours.",
        "Contaminated water supply reported in {location}.",
        "Gas leakage complaint from {location}, urgent attention needed.",
    ],
    "Transportation": [
        "Overcrowded buses on {location} route making commute unsafe.",
        "Delayed metro service at {location} causing commuter distress.",
        "Bus stop shelter damaged in {location}, exposing commuters to rain.",
    ],
    "Sanitation": [
        "Garbage not collected in {location} for {days} days.",
        "Open drains near {location} are breeding mosquitoes.",
        "Overflowing sewage in {location}, foul smell reported.",
    ],
    "Health and Safety": [
        "Stray dogs attacking pedestrians in {location}.",
        "Unattended electric wires hanging in {location}, posing danger.",
        "Public toilet in {location} in unhygienic condition.",
    ],
    "Education": [
        "Shortage of teachers in {school}.",
        "Ceiling fan fell in {school}, students narrowly escaped.",
        "No drinking water in {school} for the last {days} days.",
    ],
    "Housing": [
        "Illegal construction in {location} affecting ventilation.",
        "Water seepage in government flats at {location}.",
        "Lift not working in {location} apartment block.",
    ],
    "Employment": [
        "Workers at {company} allege non-payment of wages.",
        "Unsafe conditions at construction site in {location}.",
        "Laborers at {location} demand basic protective gear.",
    ],
    "Public Services": [
        "Long queues at {location} passport office causing delays.",
        "Aadhaar center at {location} closed without notice.",
        "Ration card service delayed for weeks in {location}.",
    ],
    "Environmental": [
        "Trees being cut illegally in {location}.",
        "Factory in {location} emitting black smoke.",
        "Garbage burning in open near {location}.",
    ],
    "Law and Order": [
        "Chain snatching reported in {location}.",
        "Police did not respond on time to {location} complaint.",
        "Increase in thefts reported from {location}.",
    ],
    "Healthcare": [
        "Lack of staff in {location} government hospital.",
        "Ambulance took over 1 hour to arrive in {location}.",
        "Patients at {location} hospital forced to sleep on floor.",
    ],
    "Consumer Rights": [
        "Customer cheated at {brand} outlet in {location}.",
        "Fake product sold at {brand} shop in {location}.",
        "No refund provided by {company} despite repeated complaints.",
    ],
    "Traffic Management": [
        "Traffic light not working at {location} crossing.",
        "Encroachment causing bottleneck in {location}.",
        "Parking issues near {location} market area.",
    ],
    "Social Welfare": [
        "Old age pension delayed for residents of {location}.",
        "Poor families in {location} denied access to free ration.",
        "Widow assistance scheme not reaching beneficiaries in {location}.",
    ]
}

priority_labels = ["Low", "Medium", "High"]

def generate_text(templates):
    template = random.choice(templates)
    return template.format(
        location=fake.city(),
        days=random.randint(1, 30),
        school=fake.company(),
        company=fake.company(),
        brand=fake.company()
    )

def generate_dataset(records_per_category=50):
    data = []
    for category, templates in tqdm(categories.items(), desc="Generating data"):
        for _ in range(records_per_category):
            text = generate_text(templates)
            label = random.choice(priority_labels)
            data.append([text, label])
    return pd.DataFrame(data, columns=["text", "label"])

# Generate and save to CSV
df = generate_dataset()
df.to_csv("grievance_dataset_generated.csv", index=False, header=True, quoting=csv.QUOTE_ALL)
print("✅ Done! Saved 1.5k million grievances to 'grievance_dataset_generated.csv'")