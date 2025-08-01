import re
import csv
import json
import requests

# Fetch the raw README markdown
url = "https://raw.githubusercontent.com/kilimchoi/engineering-blogs/master/README.md"
response = requests.get(url)
readme_text = response.text

companies = []
current_letter = None

# Parse markdown lines
for line in readme_text.splitlines():
    # Detect section headers (like #### A companies)
    letter_match = re.match(r'####\s+(\w)\s+companies', line)
    if letter_match:
        current_letter = letter_match.group(1)
        continue

    # Detect blog links
    entry_match = re.match(r'\*\s+(.+?)\s+(https?://\S+)', line)
    if entry_match and current_letter:
        companies.append({
            'company': entry_match.group(1).strip(),
            'url': entry_match.group(2).strip()
        })

# ✅ Save as JSON
with open("engineering_blogs.json", "w", encoding="utf-8") as f_json:
    json.dump(companies, f_json, indent=2)


print(f"✅ Saved {len(companies)} entries to engineering_blogs.json")