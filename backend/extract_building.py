
import pandas as pd
from pathlib import Path

# Locate the original electricity CSV
file_path = Path(input("Enter the path to electricity.csv: ").strip().strip('"'))

if not file_path.exists():
    print("File not found. Check the path.")
    raise SystemExit

print("\nReading electricity data...")
df = pd.read_csv(file_path, index_col=0)

print("\nAvailable building columns:")
for i, column in enumerate(df.columns):
    print(f"{i}: {column}")

choice = int(input("\nEnter the number of the building to extract: "))

if choice < 0 or choice >= len(df.columns):
    print("Invalid selection.")
    raise SystemExit

building = df.columns[choice]

result = pd.DataFrame({
    "timestamp": df.index,
    "electricity_kwh": pd.to_numeric(df[building], errors="coerce")
})

result = result.dropna(subset=["electricity_kwh"])

output_path = Path("commercial_building_sample.csv")
result.to_csv(output_path, index=False)

print("\nExtraction successful!")
print("Selected building:", building)
print("Total records:", len(result))
print("Output file:", output_path.resolve())
print("File size:", round(output_path.stat().st_size / 1024 / 1024, 2), "MB")
