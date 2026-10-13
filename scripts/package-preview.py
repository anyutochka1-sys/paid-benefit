"""Package the static runtime from the checked-out Git commit for private hosting."""
from pathlib import Path
import shutil
import sys
import tarfile

root = Path(__file__).resolve().parent.parent
output = root / "public"
if output.exists():
    shutil.rmtree(output)
output.mkdir()
for source in root.glob("*.mjs"):
    if not source.name.endswith(".test.mjs"):
        shutil.copy2(source, output / source.name)
for name in ["index.html", "style.css", "mobile-review.html"]:
    shutil.copy2(root / name, output / name)
shutil.copytree(root / "data", output / "data")
archive = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/benefit-mobile-preview.tar.gz")
with tarfile.open(archive, "w:gz") as package:
    package.add(root / ".openai" / "hosting.json", arcname=".openai/hosting.json")
    package.add(output, arcname="public")
print(archive)
