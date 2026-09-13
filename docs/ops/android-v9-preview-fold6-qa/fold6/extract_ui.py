import re
import sys
from pathlib import Path

xml_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
needle = sys.argv[3] if len(sys.argv) > 3 else ""
xml = xml_path.read_text(encoding="utf-8")
lines = []
for t in re.findall(r'(?:text|content-desc)="([^"]+)"', xml):
    if t and t not in lines:
        lines.append(t)
out_path.write_text("\n".join(lines), encoding="utf-8")
if needle:
    pat = re.compile(
        r'<node[^>]*(?:text|content-desc)="[^"]*' + re.escape(needle) + r'[^"]*"[^>]*>'
    )
    m = pat.search(xml)
    if not m:
        Path(str(out_path) + ".xy").write_text("MISS\n", encoding="utf-8")
        sys.exit(0)
    b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', m.group(0))
    if not b:
        Path(str(out_path) + ".xy").write_text("NO_BOUNDS\n", encoding="utf-8")
        sys.exit(0)
    x1, y1, x2, y2 = map(int, b.groups())
    Path(str(out_path) + ".xy").write_text(
        f"{(x1 + x2) // 2} {(y1 + y2) // 2}\n", encoding="utf-8"
    )
