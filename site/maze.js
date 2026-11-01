// Maze letters: sentences carved out of a square lattice, after the grammar of
// Luke Bradford's "A Labyrinth Is a …" series. The white corridors are the
// letters; the black lines are only the walls around them. Every carving is a
// real maze: one way in at the top left, one way out at the bottom right, and
// every corridor reachable.
//
// Glyphs are drawn on a doubled grid. Even rows/columns are cells:
//   o  a corridor that belongs to the letter
//   .  a free corridor (sky above short letters, pockets beside strokes)
//   x  a sealed cell, like the tiny closed cells he uses for dots and the ÿ
// Between cells, "-" and "|" open the wall; a space keeps it.
// Each line of text is five cells tall: row 0 is the ascender row, rows 1–4
// the body of the letter.

const G = {
  a: [".-.", "   ", "o-o", "  |", "o-o", "| |", "o o", "| |", "o-o"],
  b: ["o .", "| |", "o .", "|  ", "o-o", "| |", "o o", "| |", "o-o"],
  c: [".-.", "   ", "o-o", "|  ", "o .", "| |", "o .", "|  ", "o-o"],
  d: [". o", "| |", ". o", "  |", "o-o", "| |", "o o", "| |", "o-o"],
  e: [".-.", "   ", "o-o", "| |", "o o", "| |", "o-o", "|  ", "o-o"],
  f: ["o-o", "| |", "o o", "|  ", "o-o", "|  ", "o .", "| |", "o ."],
  g: [".-.", "   ", "o-o", "| |", "o o", "| |", "o-o", "  |", "o-o"],
  h: ["o .", "|  ", "o-o", "| |", "o o", "| |", "o o", "| |", "o o"],
  i: ["x", " ", "o", "|", "o", "|", "o", "|", "o"],
  j: [". x", "|  ", ". o", "| |", ". o", "| |", ". o", "  |", "o-o"],
  k: ["o .", "| |", "o .", "|  ", "o o", "| |", "o-o", "| |", "o o"],
  l: ["o", "|", "o", "|", "o", "|", "o", "|", "o"],
  m: [".-.-.", "     ", "o-o-o", "| | |", "o o o", "| | |", "o o o", "| | |", "o o o"],
  n: [".-.", "   ", "o-o", "| |", "o o", "| |", "o o", "| |", "o o"],
  o: [".-.", "   ", "o-o", "| |", "o o", "| |", "o o", "| |", "o-o"],
  p: [".-.", "   ", "o-o", "| |", "o o", "| |", "o-o", "|  ", "o ."],
  q: [".-.", "   ", "o-o", "| |", "o o", "| |", "o-o", "  |", ". o"],
  r: [".-.", "   ", "o-o", "|  ", "o .", "| |", "o .", "| |", "o ."],
  s: [".-.", "   ", "o-o", "|  ", "o-o", "  |", "o-o", "| |", "o-o"],
  t: ["o .", "|  ", "o-o", "|  ", "o .", "| |", "o .", "|  ", "o-o"],
  u: [".-.", "   ", "o o", "| |", "o o", "| |", "o o", "| |", "o-o"],
  v: [".-.", "   ", "o o", "| |", "o o", "| |", "o o", "|  ", "o-o"],
  w: [".-.-.", "     ", "o o o", "| | |", "o o o", "| | |", "o o o", "| | |", "o-o-o"],
  x: [".-.", "   ", "o o", "| |", "o-o", "   ", "o-o", "| |", "o o"],
  y: [".-.", "   ", "o o", "| |", "o o", "| |", "o-o", "  |", ". o"],
  z: [".-.", "   ", "o-o", "  |", "o-o", "|  ", "o-o", "| |", "o-o"],
  "ÿ": ["x x", "   ", "o o", "| |", "o o", "| |", "o-o", "  |", ". o"],
  "í": ["x", " ", "o", "|", "o", "|", "o", "|", "o"],
};

export const ROWS = 5;
export const SLACK = 0, LETTER = 1, FREE = 2, SEALED = 3;

// Parse every glyph once into {w, cells[y][x], right[y][x], down[y][x]}.
const GLYPHS = {};
for (const [ch, rows] of Object.entries(G)) {
  const w = (rows[0].length + 1) / 2;
  const kind = { o: LETTER, ".": FREE, x: SEALED };
  const cells = [], right = [], down = [];
  for (let y = 0; y < ROWS; y++) {
    cells.push([]); right.push([]); down.push([]);
    for (let x = 0; x < w; x++) {
      cells[y].push(kind[rows[2 * y][2 * x]]);
      right[y].push(x < w - 1 && rows[2 * y][2 * x + 1] === "-");
      down[y].push(y < ROWS - 1 && rows[2 * y + 1][2 * x] === "|");
    }
  }
  GLYPHS[ch] = { w, cells, right, down };
}

export const glyphWidth = (word) => [...word].reduce((n, ch) => n + (GLYPHS[ch] ? GLYPHS[ch].w : 0), 0);
export const canSpell = (text) => [...text.replace(/ /g, "")].every((ch) => GLYPHS[ch]);

// FNV-1a, then mulberry32: every sentence and layout carves the same maze every time.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Choose where to break the sentence into lines so the carving is as large as
// the box allows, with little lattice left over. Words run together inside a
// line, as in the originals.
export function layout(words, boxW, boxH, maxCell = 56) {
  const widths = words.map(glyphWidth);
  const n = words.length;
  let best = null;
  const maxLines = Math.min(n, 7);
  // Every composition of the words into contiguous lines (n is small).
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const lines = [[words[0]]];
    const lw = [widths[0]];
    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) { lines.push([]); lw.push(0); }
      lines[lines.length - 1].push(words[i]);
      lw[lw.length - 1] += widths[i];
    }
    const k = lines.length;
    if (k > maxLines) continue;
    const W = Math.max(...lw), H = k * ROWS;
    const cell = Math.min(maxCell, boxW / W, boxH / H);
    const slack = lw.reduce((s, w) => s + (W - w), 0) / (k * W);
    // A one-word line is allowed ("isa" is a line in the originals) but a
    // dangling single "a" at the end reads badly.
    const orphan = lines[k - 1].length === 1 && lines[k - 1][0].length < 2 ? 0.25 : 0;
    // The originals are 2:1 to 3:1; very long strips lose the look of a page.
    const wide = Math.max(0, W / H - 3.2) * 0.12;
    // Short lines are justified with word spaces; wide ones read as holes.
    let holes = 0;
    lines.forEach((l, li) => {
      const slots = l.length - 1 + (li > 0) + (li < k - 1);
      const room = Math.ceil((W - lw[li]) / Math.max(1, slots));
      holes += Math.max(0, room - 2);
    });
    const score = cell * (1 - 1.8 * slack - orphan - wide - 0.07 * holes) - k * 0.01;
    if (!best || score > best.score) best = { score, lines: lines.map((l) => l.join(" ")), W, H, cell };
  }
  return best;
}

// Build the maze for a list of lines (words separated by spaces).
//
// The frame is always a plain rectangle with two gaps, as in the series: no
// indents and no dead cells inside it. A line shorter than the longest is
// justified: its spare columns become word spaces, small open rooms of free
// corridor (toned like the rest) set between its words.
export function carve(lines, seedText) {
  const W = Math.max(...lines.map(glyphWidth));
  const H = lines.length * ROWS;
  const N = W * H;
  const kind = new Uint8Array(N); // SLACK by default
  const glyphOf = new Int16Array(N).fill(-1);
  const right = new Uint8Array(N), down = new Uint8Array(N);
  const id = (x, y) => y * W + x;

  let gi = 0;
  const space = (x0, y0, w, g) => {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < w; x++) {
        const i = id(x0 + x, y0 + y);
        kind[i] = FREE;
        glyphOf[i] = g;
        right[i] = x < w - 1 ? 1 : 0;
        down[i] = y < ROWS - 1 ? 1 : 0;
      }
    }
  };
  lines.forEach((line, li) => {
    const words = line.split(" ");
    const spare = W - glyphWidth(line);
    // Share the spare columns among the gaps between words and the two ends of
    // the line, middle gaps first. The first line keeps its start and the last
    // its end, so the way in and the way out both open into a letter.
    const slots = [];
    if (li > 0) slots.push(0);
    for (let w = 1; w < words.length; w++) slots.push(w);
    if (li < lines.length - 1) slots.push(words.length);
    const mid = words.length / 2;
    slots.sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid));
    const widths = new Array(words.length + 1).fill(0);
    for (let k = 0; k < spare && slots.length; k++) widths[slots[k % slots.length]] += 1;
    let x0 = 0;
    const y0 = li * ROWS;
    const gap = (w) => { if (widths[w]) { space(x0, y0, widths[w], gi++); x0 += widths[w]; } };
    words.forEach((word, wi) => { gap(wi); placeWord(word); });
    gap(words.length);

    function placeWord(word) {
    for (const ch of word) {
      const g = GLYPHS[ch];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < g.w; x++) {
          const i = id(x0 + x, y0 + y);
          kind[i] = g.cells[y][x];
          glyphOf[i] = gi;
          right[i] = g.right[y][x] ? 1 : 0;
          down[i] = g.down[y][x] ? 1 : 0;
        }
      }
      x0 += g.w;
      gi++;
    }
    }
  });

  // Free cells that meet across a letter boundary join into long runners,
  // like the corridors that run along the tops of the originals.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = id(x, y), b = id(x + 1, y);
      if (kind[a] === FREE && kind[b] === FREE && glyphOf[a] !== glyphOf[b]) right[a] = 1;
    }
  }

  // Union-find over the corridors that exist so far.
  const parent = new Int32Array(N).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a === b) return false; parent[a] = b; return true; };
  const open = (i) => kind[i] === LETTER || kind[i] === FREE;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = id(x, y);
      if (x < W - 1 && right[i]) union(i, i + 1);
      if (y < H - 1 && down[i]) union(i, i + W);
    }
  }

  // Join the pieces with the fewest, least disruptive openings: a random
  // minimum spanning tree over the walls between separate pieces. Opening a
  // wall between two free corridors costs little; cutting into a letter costs
  // more, and cutting one letter into another costs most.
  const rand = rng(hash(seedText + "|" + lines.join("/")));
  const cost = (a, b) => {
    const ka = kind[a], kb = kind[b];
    let c = ka === FREE && kb === FREE ? 1 : ka === FREE || kb === FREE ? 3 : 7;
    if (ka === LETTER && kb === LETTER && glyphOf[a] === glyphOf[b]) c = 12;
    // A side opening into a letter reads as a new stroke (an l becomes a k);
    // joins at the top or the baseline read as ligatures instead.
    const ya = ((a / W) | 0) % ROWS;
    if (b === a + 1 && (ka === LETTER || kb === LETTER) && ya !== 0 && ya !== ROWS - 1) c += 5;
    return c + rand() * 2.5;
  };
  const walls = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = id(x, y);
      if (!open(i)) continue;
      if (x < W - 1 && !right[i] && open(i + 1)) walls.push([cost(i, i + 1), i, 0]);
      if (y < H - 1 && !down[i] && open(i + W)) walls.push([cost(i, i + W), i, 1]);
    }
  }
  walls.sort((p, q) => p[0] - q[0]);
  for (const [, i, dir] of walls) {
    const j = dir ? i + W : i + 1;
    if (union(i, j)) (dir ? down : right)[i] = 1;
  }

  // Distance of every corridor from the entrance: the order of the carving,
  // and the route out.
  const dist = new Int32Array(N).fill(-1);
  const prev = new Int32Array(N).fill(-1);
  const queue = [0];
  dist[0] = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % W, y = (i / W) | 0;
    const nbrs = [];
    if (x < W - 1 && right[i]) nbrs.push(i + 1);
    if (x > 0 && right[i - 1]) nbrs.push(i - 1);
    if (y < H - 1 && down[i]) nbrs.push(i + W);
    if (y > 0 && down[i - W]) nbrs.push(i - W);
    for (const j of nbrs) if (dist[j] < 0) { dist[j] = dist[i] + 1; prev[j] = i; queue.push(j); }
  }
  const path = [];
  for (let i = N - 1; i >= 0; i = prev[i]) path.unshift(i);

  return { W, H, kind, right, down, dist, path, lines };
}
