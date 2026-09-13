import re
import sys
from pathlib import Path

xml = Path(sys.argv[1]).read_text(encoding="utf-8")
seen = []
for t in re.findall(r'(?:text|content-desc)="([^"]+)"', xml):
    if t and t not in seen:
        seen.append(t)
        print(t)
