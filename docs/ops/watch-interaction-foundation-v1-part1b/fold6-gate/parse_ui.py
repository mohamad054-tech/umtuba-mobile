import re
import sys

path = sys.argv[1]
text = open(path, encoding="utf-8", errors="replace").read()
print("LEN", len(text))
seen = []
for m in re.finditer(
    r'(?:content-desc|text)="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',
    text,
):
    label = m.group(1).strip()
    if not label:
        continue
    row = f"{label} @ {m.group(2)},{m.group(3)}-{m.group(4)},{m.group(5)}"
    if row not in seen:
        seen.append(row)
        sys.stdout.buffer.write((row + "\n").encode("utf-8", "replace"))
