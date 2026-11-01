#!/usr/bin/env python3
"""Read Luke Bradford's published maze poems out of their PDFs into site/poems.js.

    python3 tools/poems/extract.py --pdfs DIR [--pdfs DIR ...]

DIR holds the PDFs, by the file names below: the free PDFs linked from
lukebradford.xyz/publications, Timglaset's free PDF of Four Paths, and for
the three pieces published only as images, the author's design PDFs (checked
against the published images by verify.py; see PUBLISHED_IMAGES).
Needs PyMuPDF (`pip install pymupdf`).

Nothing is redrawn. Every maze in these PDFs is a set of straight vector
strokes of one width, with butt caps, in one colour. Each stroke is stored
as its two endpoints, in cells, from the top-left post of its maze. The grid
pitch and origin are only a change of units; the round trip back to points
is checked by tools/poems/verify.py.

Rule: only published poems, and only exact reproductions.
"""
import argparse, json, os, re, statistics, sys

import fitz  # PyMuPDF

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "site", "poems.js")

# id, title, credit (HTML), file, pages: in order of publication.
PIECES = [
    ("four-paths", "Four Paths", "Originally published as a chapbook by Timglaset Editions, July 2018",
     "Four-Paths-Free.pdf", [3, 4, 5, 6]),
    ("four-paths-ii", "Four Paths II", "Originally published in <i>Concrete &amp; Constraint</i> (Penteract Press), November 2018",
     "Four Paths II.pdf", [1, 2, 3, 4]),
    ("two-paths", "Two Paths", "Originally published as a leaflet by No Press, March 2019",
     "Two Paths.pdf", [1]),
    ("library-of-babel", "A Labyrinth Is a Library of Babel", "Originally published online in <i>petrichor</i>, April 2019",
     "Luke Bradford — “A Labyrinth Is a Library of Babel”.pdf", [1]),
    ("rabbit-hole", "A Labyrinth Is a Rabbit Hole", "Originally published as a broadside by The Blasted Tree, 2019",
     "a labyrinth is a rabbit hole 6.pdf", [1]),
    ("barrel-of-laughs", "A Labyrinth Is a Barrel of Laughs", "Originally published as a postcard by Timglaset, December 2019",
     "A Labyrinth Is a Barrel of Laughs.pdf", [1]),
    ("mesh", "Mesh", "Originally published online by <i>RENEGADE</i>, June 2020",
     "Mesh.pdf", [1]),
    ("narrow-hell", "A Labyrinth Is a Narrow Hell", "Originally published in <i>Myth &amp; Metamorphosis</i> (Penteract Press), October 2020",
     "A Labyrinth Is a Narrow Hell.pdf", [1]),
    ("borderline", "A Labyrinth Is a Borderline", "Originally published in <i>Myth &amp; Metamorphosis</i> (Penteract Press), October 2020",
     "A Labyrinth Is a Borderline.pdf", [1]),
    ("barely-real", "A Labyrinth Is Barely Real", "Originally published in <i>The Minute Review</i>, May 2022",
     "a labyrinth is barely real 7.pdf", [1]),
    ("language-is-a-trap", "Language Is a Trap", "Originally published in <i>Buzdokuz</i>, November 2022",
     "Language Is a Trap.pdf", [1]),
    ("one-path", "One Path", "Originally published as a leaflet by Paper View Books, October 2024",
     "One Path.pdf", [1]),
]

# Pieces published only as images. Their vector files are the author's own
# design files, so verify.py checks each against the published image: the same
# wall on every cell edge, and every differing pixel on the edge of a stroke.
PUBLISHED_IMAGES = {
    "library-of-babel": dict(file="A-Labyrinth-Is-a-Library-of-Babel-957-x-398.png",
                             url="https://petrichormag.com/wp-content/uploads/2019/03/A-Labyrinth-Is-a-Library-of-Babel-957-x-398.png"),
    "rabbit-hole": dict(file="A+Labyrinth+Is+a+Rabbit+Hole+2500+x+1267.png",
                        url="https://images.squarespace-cdn.com/content/v1/537906c1e4b0e00f98115861/1555420047008-1R6QHDXOWLH28QTJHD2J/A+Labyrinth+Is+a+Rabbit+Hole+2500+x+1267.png"),
    # A scan, at 150 dpi: the left half of the spread on page 5.
    "barely-real": dict(file="theminutereview2-4.pdf", page=5, half="left",
                        url="https://derekbeaulieu.ca/wp-content/uploads/2022/05/theminutereview2-4.pdf"),
}

HEADER = """// Luke Bradford's published maze poems, reproduced exactly.
//
// Every wall segment below was read from the vector PDF of the piece (the free
// PDFs linked from lukebradford.xyz/publications, Timglaset's free PDF of Four
// Paths, and for pieces published only as images, the author's design PDF,
// checked wall by wall against the published image), not redrawn. Coordinates are in cells, measured from the
// top-left post of each maze (and each maze's x, y from the top-left post of
// the first maze on its page); each segment is x1, y1, x2, y2 and is drawn
// with butt caps at the stroke width given (a fraction of a cell), in the
// colour of the PDFs. Nothing here may be edited by hand: regenerate it from
// the sources with tools/poems/extract.py, and check it against them pixel for
// pixel with tools/poems/verify.py.
//
// Rule: only published poems, and only exact reproductions.

"""


def find(dirs, name):
    for d in dirs:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    sys.exit(f"missing source PDF: {name}")


def open_page(path, pn):
    page = fitz.open(path)[pn - 1]
    # Pages 3-4 of the Four Paths PDF carry a /Rotate 180 flag; the poems are
    # upright in the page's own coordinates (as in the standalone files).
    page.set_rotation(0)
    return page


def strokes(page):
    out = []
    for d in page.get_drawings():
        for it in d["items"]:
            assert it[0] == "l", f"not a straight stroke: {it[0]}"
            assert tuple(d["lineCap"]) == (0, 0, 0), "not a butt cap"
            out.append((it[1].x, it[1].y, it[2].x, it[2].y, d["width"], tuple(round(c, 4) for c in d["color"])))
    return out


def bands(segs, w):
    """Separate mazes stacked on one page, where a band of the page has no ink."""
    spans = sorted((min(s[1], s[3]) - w, max(s[1], s[3]) + w, i) for i, s in enumerate(segs))
    groups, cur, end = [], [], -1e9
    for a, b, i in spans:
        if cur and a > end + 2 * w:
            groups.append(cur)
            cur = []
        cur.append(i)
        end = max(end, b)
    groups.append(cur)
    return [[segs[i] for i in g] for g in groups]


def fit(coords, p0):
    """Least-squares grid pitch along one axis."""
    c0 = min(coords)
    k = [round((c - c0) / p0) for c in coords]
    n = len(coords)
    mk, mc = sum(k) / n, sum(coords) / n
    p = sum((a - mk) * (c - mc) for a, c in zip(k, coords)) / sum((a - mk) ** 2 for a in k)
    return p, max(abs((c - (mc - p * mk)) / p - a) for a, c in zip(k, coords))


def maze(segs):
    w = statistics.median(s[4] for s in segs)
    assert all(abs(s[4] - w) < 0.01 for s in segs), "strokes of more than one width"
    assert len({s[5] for s in segs}) == 1, "strokes of more than one colour"
    vert = [s for s in segs if abs(s[0] - s[2]) < 1e-3]
    horz = [s for s in segs if abs(s[1] - s[3]) < 1e-3]
    assert len(vert) + len(horz) == len(segs), "a stroke that is not horizontal or vertical"
    px, ex = fit([s[0] for s in vert], 4 * w)
    py, ey = fit([s[1] for s in horz], 4 * w)
    p = (px + py) / 2
    ox, oy = min(s[0] for s in vert), min(s[1] for s in horz)
    W = round((max(s[0] for s in vert) - ox) / p)
    H = round((max(s[1] for s in horz) - oy) / p)
    c = lambda v, o: round((v - o) / p, 5)
    return {
        "W": W, "H": H, "stroke": round(w / p, 4),
        "segs": [v for x1, y1, x2, y2, *_ in segs for v in (c(x1, ox), c(y1, oy), c(x2, ox), c(y2, oy))],
        # Not published to the site: how to map cells back onto the PDF page.
        "pitch_pt": p, "origin_pt": (ox, oy), "fit_err": max(ex, ey), "color": segs[0][5], "raw": segs,
    }


def extract(dirs):
    poems = []
    for pid, title, credit, fname, pages in PIECES:
        path = find(dirs, fname)
        pl = []
        for pn in pages:
            page = open_page(path, pn)
            segs = strokes(page)
            ms = [maze(b) for b in bands(segs, segs[0][4])]
            o, pitch = ms[0]["origin_pt"], ms[0]["pitch_pt"]
            for m in ms:
                assert abs(m["pitch_pt"] - pitch) < 1e-3
                m["x"] = round((m["origin_pt"][0] - o[0]) / pitch, 5)
                m["y"] = round((m["origin_pt"][1] - o[1]) / pitch, 5)
                m["file"], m["page"] = path, pn
            pl.append({
                "source": f"{fname} p{pn}",
                "W": round(max(m["x"] + m["W"] for m in ms), 5),
                "H": round(max(m["y"] + m["H"] for m in ms), 5),
                "mazes": ms,
            })
        poems.append({"id": pid, "title": title, "credit": credit, "pages": pl})
    return poems


PUBLIC = ("x", "y", "W", "H", "stroke", "segs")


def public(poems):
    return [{**{k: p[k] for k in ("id", "title", "credit")},
             "pages": [{"source": pg["source"], "W": pg["W"], "H": pg["H"],
                        "mazes": [{k: m[k] for k in PUBLIC} for m in pg["mazes"]]} for pg in p["pages"]]}
            for p in poems]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--pdfs", action="append", required=True, help="a folder holding the published PDFs")
    args = ap.parse_args()
    poems = extract(args.pdfs)
    inks = {m["color"] for p in poems for pg in p["pages"] for m in pg["mazes"]}
    assert len(inks) == 1, inks
    ink = "#%02x%02x%02x" % tuple(round(c * 255) for c in inks.pop())
    js = HEADER + f'export const INK = "{ink}";\nexport const POEMS = ' + json.dumps(public(poems), separators=(",", ":")) + ";\n"
    with open(OUT, "w") as f:
        f.write(js)
    for p in poems:
        for pg in p["pages"]:
            print(f"{pg['source']:42s}", ", ".join(f"{m['W']}x{m['H']} ({len(m['segs']) // 4} strokes, fit {m['fit_err']:.4f})" for m in pg["mazes"]))
    print(f"wrote {os.path.relpath(OUT, ROOT)}: {len(js.encode()):,} bytes, ink {ink}")


if __name__ == "__main__":
    main()
