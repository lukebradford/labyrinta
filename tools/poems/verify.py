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

4. Published images: for the pieces published only as images (PUBLISHED_IMAGES
   in extract.py; download them into a --pdfs folder), reads the wall on every
   cell edge off the published image and requires it to match, then renders
   the vector onto the image's frame and requires every differing pixel to
   lie within 1 px of a stroke's edge.

Exits non-zero if anything fails. Needs PyMuPDF, numpy and Pillow, and
Google Chrome for step 3.
"""
import argparse, json, os, re, subprocess, sys, tempfile

import fitz
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import OUT, PUBLISHED_IMAGES, extract, find, public  # noqa: E402

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


def published_images(poems, dirs):
    from PIL import Image
    from scipy import ndimage
    ok = True
    for p in poems:
        spec = PUBLISHED_IMAGES.get(p["id"])
        if not spec:
            continue
        m = p["pages"][0]["mazes"][0]
        path = find(dirs, spec["file"])
        if path.endswith(".pdf"):
            doc = fitz.open(path)
            pix = fitz.Pixmap(doc, doc[spec["page"] - 1].get_images(full=True)[0][0])
            im = Image.frombytes("RGB" if pix.n == 3 else "L", (pix.width, pix.height), pix.samples)
            if spec.get("half") == "left":
                im = im.crop((0, 0, im.width // 2, im.height))
        else:
            im = Image.open(path).convert("RGBA")
            bg = Image.new("RGBA", im.size, "white")
            bg.alpha_composite(im)
            im = bg
        ink = np.asarray(im.convert("L")) < 128
        # The frame: the rows and columns with the longest runs of ink.
        rs, cs = ink.sum(1), ink.sum(0)
        ys, xs = np.where(rs > 0.35 * rs.max())[0], np.where(cs > 0.35 * cs.max())[0]
        ink = ink[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        W, H = m["W"], m["H"]
        px, py = ink.shape[1] / (W + m["stroke"]), ink.shape[0] / (H + m["stroke"])
        ox, oy = px * m["stroke"] / 2, py * m["stroke"] / 2
        r = max(1, int(min(px, py) / 16))
        dark = lambda x, y: ink[int(round(y)) - r:int(round(y)) + r + 1, int(round(x)) - r:int(round(x)) + r + 1].mean() > 0.5
        got_h = np.array([[dark(ox + (x + .5) * px, oy + y * py) for x in range(W)] for y in range(H + 1)])
        got_v = np.array([[dark(ox + x * px, oy + (y + .5) * py) for x in range(W + 1)] for y in range(H)])
        want_h, want_v = np.zeros_like(got_h), np.zeros_like(got_v)
        s = m["segs"]
        for k in range(0, len(s), 4):
            x1, y1, x2, y2 = s[k:k + 4]
            if abs(y1 - y2) < 1e-6:
                a, b = sorted((x1, x2))
                for x in range(W):
                    want_h[round(y1), x] |= a <= x + .25 and b >= x + .75
            else:
                a, b = sorted((y1, y2))
                for y in range(H):
                    want_v[y, round(x1)] |= a <= y + .25 and b >= y + .75
        walls = int((got_h != want_h).sum() + (got_v != want_v).sum())
        # The vector, rendered onto the published frame.
        page = page_of(m)
        w, (pox, poy), pitch = m["stroke"] * m["pitch_pt"], m["origin_pt"], m["pitch_pt"]
        clip = fitz.Rect(pox - w / 2, poy - w / 2, pox + W * pitch + w / 2, poy + H * pitch + w / 2)
        zx, zy = ink.shape[1] / clip.width, ink.shape[0] / clip.height
        ref = gray(page.get_pixmap(matrix=fitz.Matrix(zx, 0, 0, zy, -clip.x0 * zx, -clip.y0 * zy), clip=clip,
                                   colorspace=fitz.csGRAY, alpha=False)) < 128
        hh, ww = min(ref.shape[0], ink.shape[0]), min(ref.shape[1], ink.shape[1])
        ref, got = ref[:hh, :ww], ink[:hh, :ww]
        edge = (ref ^ ndimage.binary_erosion(ref)) | (~ref ^ ndimage.binary_erosion(~ref))
        far = ndimage.distance_transform_edt(~edge)[ref ^ got]
        worst = float(far.max()) if far.size else 0.0
        ok &= walls == 0 and worst <= 1
        print(f"  {p['title']:36s} {spec['file'][:40]:40s} {ww}x{hh} px  walls differing: {walls}  "
              f"pixels differing: {int((ref ^ got).sum())}, at most {worst:.0f} px from a stroke's edge")
    return ok


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
    print("4. Pieces published as images, against those images:")
    imgs = published_images(poems, args.pdfs)
    print(f"worst stroke error {worst:.5f} pt" + (f", differing pixels on the site: {bad}" if args.site else ""))
    sys.exit(0 if same and imgs and worst <= TOL_PT and bad == 0 else 1)


if __name__ == "__main__":
    main()
