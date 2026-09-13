"""Find a UI node by text/content-desc and print tap coordinates. UTF-8."""
import re
import sys
from pathlib import Path

xml_path = Path(sys.argv[1])
needle = sys.argv[2]
xml = xml_path.read_text(encoding="utf-8")
pat = re.compile(
    r'<node[^>]*(?:text|content-desc)="[^"]*' + re.escape(needle) + r'[^"]*"[^>]*>'
)
m = pat.search(xml)
if not m:
    print("MISS")
    sys.exit(2)
b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', m.group(0))
if not b:
    print("NO_BOUNDS")
    sys.exit(3)
x1, y1, x2, y2 = map(int, b.groups())
print(f"{(x1 + x2) // 2} {(y1 + y2) // 2}")
