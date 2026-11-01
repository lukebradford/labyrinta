# Vision

**Labÿrínta is a place to walk Luke Bradford's published maze poems.** Each poem appears exactly as it was published, wall for wall, carved out of a sheet of graph paper. Then the visitor takes Ariadne's thread in at the entrance, walks the letters, and leaves by the exit into the next poem. The poems are the site. Everything else (the lattice, the carving, the thread, the order of the rooms) is staging for them.

## The owner's rules (non-negotiable)

- **Only his published poems, only exact reproductions.** Every wall segment comes from a vector PDF (`tools/poems/extract.py`): the published free PDF, or, for the three pieces published only as images (Library of Babel, Rabbit Hole, Barely Real), his design PDF, verified against the published image wall by wall. `tools/poems/verify.py` checks it all: data identical, every stroke within 0.002 pt, and the site's own canvas pixel-identical to MuPDF's render of the PDF. Never edit `site/poems.js` by hand. Run both tools after any change to drawing code.
- **No poems of the site's own.** No generated sentences, no alphabet of mine, no approximations, nothing unpublished (titles included). The ÿ mark of his unpublished logo is out too.
- **The pieces as published.** If a poem has one gap (*Language Is a Trap*), it has no way out, and the site says nothing. If it has sealed or unreachable cells, they stay. A rectangle frame stays a rectangle.
- **Credit** every piece with venue and date, top left, as on the published pages.

## Principles

- **The page is the lattice.** The template grid fills the screen. Each poem is carved out of it (the template edges that are not walls dissolve in flood order from the entrance) and then stands alone on a one-cell clearing. Text sits in clearings too.
- **The thread is the only addition.** Drawn in the ink of the PDFs, outside the poem until it is taken up. Walking never alters a wall.
- **One room per published page**, in order of publication. Multi-maze pages (*Two Paths*) are walked maze by maze.
- **Quiet.** No chrome, no explanation. A row of small cells is the only navigation; walked rooms fill in.
- **Light only.** The poems are black on white; inverting them would not be the published piece.

## Where it is going

1. **Any further published maze pieces** go through the same pipeline: a vector source, verified against the published version (PDF strokes, or wall by wall against a published image).
2. **Walking feel**: the thread's motion on touch (fat-finger tolerance on *Mesh*'s small cells; pinch-zoom into big pieces), a trace of every thread walked in this browser, a quiet acknowledgement at the end of the last room.
3. **Reach**: a shareable og:image per room (rendered from the same data, verified), and linking out to where each piece was published.
4. **Performance**: *Mesh* and *One Path* redraw thousands of strokes per frame while walking; cache the settled poem in an offscreen canvas.

## Known facts about the pieces

- Four Paths: Timglaset's free PDF, pp. 3–6. Pages 3–4 carry a /Rotate 180 page flag, but the poems are upright in page coordinates (they match the standalone files). Page 5 is the second edition of *Four Paths 3*.
- Library of Babel (petrichor PNG), Rabbit Hole (The Blasted Tree PNG), Barely Real (The Minute Review 2.4, a 150 dpi scan): same walls on every edge as the published images; Rabbit Hole's vector renders to the published PNG with 0 differing pixels. The published PNGs are pure black; the site keeps the files' ink, #231f20.
- Rabbit Hole's date is uncertain: The Blasted Tree's page is dated April 2019, a bookshop listing says 2020; credited "2019". Language Is a Trap's free PDF says Buzdokuz, November 2022, though the owner's link points at a 2021 issue.
- Four Paths II exits top right and has large unreachable regions; Barrel of Laughs has 12 unreachable cells, Library of Babel 104, Mesh 355.
