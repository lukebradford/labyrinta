#!/usr/bin/env python3
"""Check site/poems.js, and the site's own drawing of it, against the published PDFs.

    python3 tools/poems/verify.py --pdfs DIR [--pdfs DIR ...] [--site URL]

1. Data: regenerates the poems from the PDFs and requires site/poems.js to
   match exactly.
2. Round trip: maps every stroke in site/poems.js back onto its PDF page and
   requires its ends and width to match the PDF's stroke to 0.002 pt.
3. Site (with --site, e.g. http://localhost:8000/): screenshots every room in
   headless Chrome at 2x with 44 px cells and compares the drawn mazes with
   MuPDF renders of the published pages on the same pixel grid: every pixel\n   must be ink in both or paper in both (at half grey).

Exits non-zero if anything fails. Needs PyMuPDF, numpy and Pillow, and
Google Chrome for step 3.
"""
import argparse, json, os, re, subprocess, sys, tempfile

import fitz
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import OUT, extract, public  # noqa: E402

CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def gray(pix):
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)


def page_of(m):
    page = fitz.open(m["file"])[m["page"] - 1]
    page.set_rotation(0)
    return page


TOL_PT = 0.002  # a 36,000th of an inch


def round_trip(poems):
    """Every stored stroke, mapped back onto its page, against the PDF's own stroke."""
    worst = 0
    for p in poems:
        for pg in p["pages"]:
            for m in pg["mazes"]:
                pitch, (ox, oy), s = m["pitch_pt"], m["origin_pt"], m["segs"]
                assert len(s) == 4 * len(m["raw"])
                err = 0
                for j, (x1, y1, x2, y2, w, _) in enumerate(m["raw"]):
                    back = (s[4 * j] * pitch + ox, s[4 * j + 1] * pitch + oy, s[4 * j + 2] * pitch + ox, s[4 * j + 3] * pitch + oy)
                    err = max(err, *(abs(u - v) for u, v in zip(back, (x1, y1, x2, y2))), abs(m["stroke"] * pitch - w))
                worst = max(worst, err)
                print(f"  {pg['source']:42s} {m['W']}x{m['H']}  {len(m['raw']):5d} strokes  worst error {err:.5f} pt")
    return worst


def chrome(url, w, h, dpr, *extra):
    return subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},{h}",
                           f"--force-device-scale-factor={dpr}", "--force-prefers-reduced-motion",
                           "--virtual-time-budget=8000", *extra, url], check=True, capture_output=True, text=True).stdout


def site(poems, base):
    from PIL import Image
    VW, VH, DPR, CELL = 3200, 2600, 2, 44
    bad, n = 0, 0
    tmp = tempfile.mkdtemp()
    for p in poems:
        for k, pg in enumerate(p["pages"]):
            n += 1
            slug = p["id"] if len(p["pages"]) == 1 else f"{p['id']}-{k + 1}"
            url = f"{base.rstrip('/')}/index.html?verify={n}#{slug}"
            png = os.path.join(tmp, slug + ".png")
            chrome(url, VW, VH, DPR, f"--screenshot={png}")
            tag = re.search(r"<canvas[^>]*>", chrome(url, VW, VH, DPR, "--dump-dom")).group(0)
            left, top, s = (float(re.search(f'data-{a}="([^"]+)"', tag).group(1)) for a in ("left", "top", "s"))
            assert s == CELL, tag
            shot = np.asarray(Image.open(png).convert("L"))
            for m in pg["mazes"]:
                page = page_of(m)
                pitch, (ox, oy) = m["pitch_pt"], m["origin_pt"]
                Z, pad = CELL * DPR / pitch, CELL * DPR // 2
                mat = fitz.Matrix(Z, 0, 0, Z, -ox * Z + pad, -oy * Z + pad)
                clip = fitz.Rect(ox - pitch / 2, oy - pitch / 2, ox + (m["W"] + 0.5) * pitch, oy + (m["H"] + 0.5) * pitch)
                ref = gray(page.get_pixmap(matrix=mat, clip=clip, colorspace=fitz.csGRAY, alpha=False))
                x0 = round((left + m["x"] * CELL) * DPR) - pad
                y0 = round((top + m["y"] * CELL) * DPR) - pad
                got = shot[y0:y0 + ref.shape[0], x0:x0 + ref.shape[1]]
                # Inside the frame only: the thread's knot waits outside the entrance.
                inner = (slice(pad - 8, -pad + 8), slice(pad - 8, -pad + 8))
                diff = int(((ref < 128) ^ (got < 128))[inner].sum())
                bad += diff
                print(f"  #{slug:22s} {m['W']}x{m['H']}  {ref.shape[1]}x{ref.shape[0]} px  differing: {diff}")
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pdfs", action="append", required=True)
    ap.add_argument("--site", help="base URL of a local server for site/, to check the canvas too")
    args = ap.parse_args()
    poems = extract(args.pdfs)
    data = json.loads(re.search(r"export const POEMS = (\[.*\]);", open(OUT).read(), re.S).group(1))
    same = data == public(poems)
    print("1. site/poems.js matches the PDFs:", "yes" if same else "NO")
    print("2. Every stroke against the PDF's own strokes:")
    worst = round_trip(poems)
    bad = 0
    if args.site:
        print("3. The site's canvas against MuPDF renders of the PDFs:")
        bad += site(poems, args.site)
    print(f"worst stroke error {worst:.5f} pt" + (f", differing pixels on the site: {bad}" if args.site else ""))
    sys.exit(0 if same and worst <= TOL_PT and bad == 0 else 1)


if __name__ == "__main__":
    main()
