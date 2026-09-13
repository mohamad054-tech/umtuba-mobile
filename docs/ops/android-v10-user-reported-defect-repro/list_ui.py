import re
import sys
from pathlib import Path

xml_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
raw = xml_path.read_text(encoding="utf-8")
lines = []
for n in re.findall(r"<node[^>]*>", raw):
    t = re.search(r'text="([^"]*)"', n)
    d = re.search(r'content-desc="([^"]*)"', n)
    b = re.search(r'bounds="([^"]+)"', n)
    text = t.group(1) if t else ""
    desc = d.group(1) if d else ""
    bounds = b.group(1) if b else ""
    if text or desc:
        lines.append(f"{text} | {desc} | {bounds}")
out_path.write_text("\n".join(lines), encoding="utf-8")
