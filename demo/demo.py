"""Turn the included sample readings into a tiny report.

Run: python3 demo.py
Try: python3 demo.py --limit 28
JSON: python3 demo.py --json
"""
import argparse
import csv
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--limit", type=float, default=30)
parser.add_argument("--json", action="store_true")
args = parser.parse_args()

source = Path(__file__).parent / "data" / "readings.csv"
with source.open() as file:
    readings = list(csv.DictReader(file))
values = [float(row["temperature_c"]) for row in readings]
report = {
    "samples": len(values),
    "average_c": round(sum(values) / len(values), 1),
    "peak_c": max(values),
    "alerts": sum(value > args.limit for value in values),
}
if args.json:
    print(json.dumps(report, indent=2))
else:
    print("\n  DESKLAB / SENSOR REPORT")
    print("  " + "-" * 30)
    for key, value in report.items():
        print(f"  {key:<14} {value}")
    print(f"\n  Threshold: {args.limit:g} C")
    print("  One small dataset. A clear story.\n")
