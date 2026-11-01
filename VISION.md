# Vision

**Labÿrínta is a lattice that keeps being carved into sentences.** The whole screen is graph paper: the template from Luke Bradford's *A Labyrinth Is a Template*. Out of it, sentences are cut as mazes, in the grammar of his series. The white corridors are the letters, the black lines are only walls, there is one way in at the top left and one way out at the bottom right, and every corridor can be reached. Each sentence is at once readable, walkable, and a definition of what a labyrinth is.

## The owner's rule (non-negotiable)

**Luke Bradford's visual poems may appear on the site only if 1) they have been published, and 2) they are exact reproductions, down to every segment of wall.** No approximate versions: never carve his titles or lines with this site's generator, never redraw his pieces in this alphabet, and never show unpublished mazes (including titles of unpublished pieces). The generator carves only sentences written new for the site. An exact reproduction must be built from the published piece itself (ideally its vector PDF) and checked segment by segment against it before it ships.

## Principles

- **One grammar.** Square cells, orthogonal walls of one weight (about a fifth of a cell), square caps, black on white (and its inverse in the dark). Floating stubs are counters; sealed cells are dots (the ÿ's two cells are the site's mark). Colour is held back for one rare event later: the *Any Hue* gradient.
- **Generated, never stored.** Every maze is built live from a glyph table (`site/maze.js`) and a seed. Same sentence + same line breaks = same maze, so things can be addressed and shared (`#blank-page`).
- **The series' frame.** Every carving is a plain rectangle with exactly two gaps (in at the top left, out at the bottom right): no indents, no dead cells inside. Short lines are justified with toned word spaces, never left ragged.
- **Real mazes.** The generator guarantees connectivity and a route. Anything we add must keep that true. Interaction should eventually *use* it.
- **The page is the lattice.** New rooms are clearings and carvings in the same grid, not new pages pasted on top. Text sits in clearings cut from the lattice.
- **Honest provenance.** Every carved sentence is new and says so. If an exact reproduction of a published piece is ever shown, it is credited with venue and year.
- **Quiet.** No chrome, no menus, no explanation. Discovery is the navigation.

## Where it is going (rough order)

1. ~~**Walk it.**~~ Done (change 2): drag the thread or use arrow keys; the exit carves the next sentence. (The *Four Paths* loop was removed in change 3: it carved his poems approximately.) Next: make finishing feel earned (remember solved sentences? a trace of every thread ever walked in this browser?), and let the walked thread *matter*: e.g. the route becomes the seed of the next carving.
2. **Near-twins.** New sentence pairs that differ by a swapped letter or two (the *method* of trail/trial, with new words), carved as two near-identical mazes.
3. **Rooms in the lattice**: mazes / labyrinths / wilderness (the three parts of the 2018 *Labÿrínta* manuscript); a unicursal classical labyrinth to trace slowly; a wilderness where the grid dissolves.
4. **The mesh**: zoom out until new sentences become texture (the idea of scale-as-texture, not his *Mesh*).
5. **Ambigrams**: new words that survive 180° rotation in this alphabet (his own ambigrams only as exact reproductions, if published).
6. A page of the Library of Babel: letters as walls, Wilson's algorithm, addressable.
7. A shareable image (og:image) of a carving, for reach.
8. Possibly: exact reproductions of published pieces, traced from the published PDFs and verified wall by wall. Ask the owner before starting.

## Known limits

- The glyph alphabet is mine, built in his manner, not a copy of his. Some letters are weak (`g`/`e` are mirror twins, `x`, `v`, `k`). Improve glyphs when they show up in new sentences.
- Free corridors (the sky row above short letters, pockets beside strokes) are toned faintly so the letters read. His originals avoid free corridors entirely; a denser alphabet could too.
