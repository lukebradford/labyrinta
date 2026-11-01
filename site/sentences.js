// The sentences the lattice is carved into. All are new, written for
// Labÿrínta in the manner of Luke Bradford's "A Labyrinth Is a …" series.
//
// Rule: his own visual poems may appear on the site only if they have been
// published, and only as exact reproductions, every wall segment as in the
// published piece. Never carve his titles or lines in this generator, and never
// show unpublished pieces.

export const SENTENCES = [
  ["a labyrinth is a blank page", "Labÿrínta began as one"],
  ["a labyrinth is a room that grows", ""],
  ["a labyrinth is a line that thinks", ""],
  ["a labyrinth is a corridor with second thoughts", ""],
  ["a labyrinth is a path that hesitates", ""],
  ["a labyrinth is a straight line folded", ""],
  ["a labyrinth is an answer in no hurry", ""],
  ["a labyrinth is a slow way home", ""],
  ["a labyrinth is a sentence you can stand in", ""],
  ["a labyrinth is a word for waiting", ""],
  ["a labyrinth is a tiny brain", "only the letters of labyrinth"],
  ["a labyrinth is a briny bath", "only the letters of labyrinth"],
  ["a labyrinth is a thin hint", "only the letters of labyrinth"],
  ["a labyrinth is a hint in a tiny barn", "only the letters of labyrinth"],
  ["a labyrinth is a rain in thin air", "only the letters of labyrinth"],
].map(([text, note]) => ({
  text,
  note: note ? `new · ${note}` : "new",
  slug: text.replace(/^a labyrinth is /, "").replace(/ /g, "-"),
}));
