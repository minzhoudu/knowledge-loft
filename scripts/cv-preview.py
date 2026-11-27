"""
Render the CV's first page to an image, for the sheet the lobby printer
prints (src/world/printer). Run it again whenever the CV PDF changes:

    pip install pymupdf
    python scripts/cv-preview.py

Writes public/cv/cv-page-1.jpg next to the PDF: 1024 px wide, which is
sharp enough held up to your face in the 3D view and small (~160 KB).
"""

from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "public" / "cv" / "pavle-jovanovic-cv.pdf"
OUT = ROOT / "public" / "cv" / "cv-page-1.jpg"
WIDTH = 1024

page = pymupdf.open(PDF)[0]
zoom = WIDTH / page.rect.width
pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
pixmap.save(OUT, jpg_quality=85)
print(f"{OUT.relative_to(ROOT)}: {pixmap.width}x{pixmap.height}, {OUT.stat().st_size // 1024} KB")
