# Vision

**Labÿrínta is a lattice that keeps being carved into sentences.** The whole screen is graph paper: the template from Luke Bradford's *A Labyrinth Is a Template*. Out of it, sentences are cut as mazes, in the grammar of his series. The white corridors are the letters, the black lines are only walls, there is one way in at the top left and one way out at the bottom right, and every corridor can be reached. Each sentence is at once readable, walkable, and a definition of what a labyrinth is.

## Principles

- **One grammar.** Square cells, orthogonal walls of one weight (about a fifth of a cell), square caps, black on white (and its inverse in the dark). Floating stubs are counters; sealed cells are dots (the ÿ's two cells are the site's mark). Colour is held back for one rare event later: the *Any Hue* gradient.
- **Generated, never stored.** Every maze is built live from a glyph table (`site/maze.js`) and a seed. Same sentence + same line breaks = same maze, so things can be addressed and shared (`#library-of-babel`).
- **Real mazes.** The generator guarantees connectivity and a route. Anything we add must keep that true. Interaction should eventually *use* it.
- **The page is the lattice.** New rooms are clearings and carvings in the same grid, not new pages pasted on top. Text sits in clearings cut from the lattice.
- **Honest provenance.** His published titles are credited with venue and year. Lines written here say "new". Never present invented things as his.
- **Quiet.** No chrome, no menus, no explanation. Discovery is the navigation.

## Where it is going (rough order)

1. **Walk it.** Trace the route with finger, mouse or arrow keys; the trace is a thread (Ariadne's) left on the page. Reaching the exit carves the next sentence. Loops through *Four Paths* (language → maze → labyrinth → word → language).
2. **Trail / trial.** Pairs that differ by a swapped letter, two near-identical mazes.
3. **Rooms in the lattice**: mazes / labyrinths / wilderness (the three parts of the 2018 *Labÿrínta* manuscript); a unicursal classical labyrinth to trace slowly; a wilderness where the grid dissolves.
4. **The mesh**: zoom out until sentences become texture (*Mesh*, *One Path*).
5. **Ambigrams**: rotate 180° and still read (a snow mouse, label).
6. A page of the Library of Babel: letters as walls, Wilson's algorithm, addressable.
7. A shareable image (og:image) of a carving, for reach.

## Known limits

- The glyph alphabet is mine, built in his manner, not a copy of his. Some letters are weak (`g`/`e` are mirror twins, `x`, `v`, `k`). Improve glyphs when they show up in new sentences.
- Free corridors (the sky row above short letters, pockets beside strokes) are toned faintly so the letters read. His originals avoid free corridors entirely; a denser alphabet could too.
