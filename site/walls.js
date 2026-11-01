// Reads a maze's walls back off its segments, so the poem can be walked.
// Nothing here changes how the poem is drawn; it only works out which cell
// edges are walls, where the two gaps in the frame are, and the way through.

export function graph(m) {
  const { W, H, segs } = m;
  const hwall = new Uint8Array((H + 1) * W); // edge above cell row y, at column x
  const vwall = new Uint8Array(H * (W + 1)); // edge left of cell column x, at row y
  for (let k = 0; k < segs.length; k += 4) {
    const x1 = segs[k], y1 = segs[k + 1], x2 = segs[k + 2], y2 = segs[k + 3];
    if (Math.abs(y1 - y2) < 1e-6) {
      const y = Math.round(y1), a = Math.min(x1, x2), b = Math.max(x1, x2);
      for (let x = 0; x < W; x++) if (a <= x + 0.25 && b >= x + 0.75) hwall[y * W + x] = 1;
    } else {
      const x = Math.round(x1), a = Math.min(y1, y2), b = Math.max(y1, y2);
      for (let y = 0; y < H; y++) if (a <= y + 0.25 && b >= y + 0.75) vwall[y * (W + 1) + x] = 1;
    }
  }
  const right = new Uint8Array(W * H), down = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < W - 1) right[y * W + x] = vwall[y * (W + 1) + x + 1] ? 0 : 1;
      if (y < H - 1) down[y * W + x] = hwall[(y + 1) * W + x] ? 0 : 1;
    }
  }

  // The gaps in the frame: each is a cell on the border and the side it opens.
  const gaps = [];
  for (let x = 0; x < W; x++) {
    if (!hwall[x]) gaps.push({ cell: x, side: "top" });
    if (!hwall[H * W + x]) gaps.push({ cell: (H - 1) * W + x, side: "bottom" });
  }
  for (let y = 0; y < H; y++) {
    if (!vwall[y * (W + 1)]) gaps.push({ cell: y * W, side: "left" });
    if (!vwall[y * (W + 1) + W]) gaps.push({ cell: y * W + W - 1, side: "right" });
  }
  const xy = (g) => [g.cell % W, (g.cell / W) | 0];
  const byStart = [...gaps].sort((p, q) => xy(p)[0] + xy(p)[1] - (xy(q)[0] + xy(q)[1]));
  const entrance = byStart[0];
  const exit = byStart[byStart.length - 1];

  const linked = (a, b) => {
    if (b === a + 1 && a % W !== W - 1) return right[a];
    if (b === a - 1 && b % W !== W - 1) return right[b];
    if (b === a + W) return down[a];
    if (b === a - W) return down[b];
    return 0;
  };

  // Distance from the entrance, and the way out.
  const dist = new Int32Array(W * H).fill(-1);
  const prev = new Int32Array(W * H).fill(-1);
  const queue = [entrance.cell];
  dist[entrance.cell] = 0;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of [i + 1, i - 1, i + W, i - W]) {
      if (j < 0 || j >= W * H || dist[j] >= 0 || !linked(i, j)) continue;
      dist[j] = dist[i] + 1;
      prev[j] = i;
      queue.push(j);
    }
  }
  const path = [];
  if (dist[exit.cell] >= 0) for (let i = exit.cell; i >= 0; i = prev[i]) path.unshift(i);
  let unreachable = 0;
  for (let i = 0; i < W * H; i++) if (dist[i] < 0) unreachable++;

  return { W, H, right, down, hwall, vwall, gaps, entrance, exit, linked, dist, path, unreachable };
}
