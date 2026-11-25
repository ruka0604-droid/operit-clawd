"""Build the minimal Plush Heng ToolPkg from the checked-out source."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import struct
import subprocess
import shutil

root = Path(__file__).resolve().parents[1]
src = root / "clawd_pet"
manifest = json.loads((src / "manifest.json").read_text(encoding="utf-8"))
assert manifest["toolpkg_id"] == "plush_heng"
assert all(p["id"] != manifest["toolpkg_id"] for p in manifest["subpackages"])
sub = manifest["subpackages"][0]
assert sub["id"] == "plush_heng_control"
import re
package = (src / sub["entry"]).read_text(encoding="utf-8")
metadata = json.loads(re.search(r"/\* METADATA\s*(.*?)\*/", package, re.S).group(1))
assert metadata["name"] == sub["id"]
main = (src / manifest["main"]).read_text(encoding="utf-8")
for tool in metadata["tools"]:
    name = tool["name"]
    assert "exports." + name + " =" in package, name
    channel = name.removeprefix("clawd_")
    assert "reg('" + channel + "'" in main, channel
    assert "'plush_heng." + channel + "'" in package, channel
for page in ("settings", "archive"):
    assert 'SUB = "plush_heng_control"' in (src / "ui" / page / "index.ui.js").read_text(encoding="utf-8")
paths = {"manifest.json", manifest["main"]}
paths.update(p["entry"] for p in manifest["subpackages"])
paths.update(r["path"] for r in manifest["resources"])
paths.update(p.relative_to(src).as_posix() for p in (src / "ui").rglob("*.js"))
png = (src / "sprites/ai_idle.png").read_bytes()
assert png[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", png[16:24]) == (1536, 256) and png[25] == 6
assert (src / "resources/native/clawd_host.dex").read_bytes().startswith(b"dex\n")
cfg = json.loads((src / "sprites/sprites.json").read_text(encoding="utf-8"))
assert len(cfg["ai_idle"]["hold"]) == 6
for name in sorted(paths):
    assert (src / name).is_file(), name
    if name.endswith(".js") and shutil.which("node"):
        subprocess.run(["node", "--check", str(src / name)], check=True)
out = root / "dist" / "plush_heng_v0.1.2.toolpkg"
out.parent.mkdir(exist_ok=True)
with ZipFile(out, "w", ZIP_DEFLATED) as z:
    for name in sorted(paths):
        z.write(src / name, name)
    z.write(root / "LICENSE", "LICENSE")
with ZipFile(out) as z:
    assert z.testzip() is None
    assert set(z.namelist()) == paths | {"LICENSE"}
print(out, out.stat().st_size, "bytes; archive verified")
