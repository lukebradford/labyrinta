// Modules are imported with this file's own ?v= stamp, so a returning visitor
// never pairs a new page with an old generator.
const v = new URL(import.meta.url).search;
const { layout, carve, SLACK, FREE } = await import(`./maze.js${v}`);
const { SENTENCES } = await import(`./sentences.js${v}`);

const canvas = document.getElementById("lattice");
const ctx = canvas.getContext("2d");
const caption = document.getElementById("caption");
const captionLink = caption.querySelector("a");
const note = document.getElementById("note");
const credit = document.getElementById("credit");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

let sentence = null; // the sentence being shown
let maze = null; // the carving for the current line breaks
let geo = null; // where everything sits on screen
let edges = []; // every wall segment of the carving, with its timing
let start = 0; // when the carving began
let end = 0; // when it finishes
let frame = 0;
let thread = [0]; // Ariadne's thread: the cells walked so far, from the entrance
let outAt = 0; // when the thread left by the exit (0 while still inside)

// ---------------------------------------------------------------- sentence

function pick() {
  const fromHash = SENTENCES.find((s) => s.slug === decodeURIComponent(location.hash.slice(1)));
  if (fromHash) return fromHash;
  // A different sentence from the one seen last, when possible.
  let last = null;
  try { last = localStorage.getItem("labyrinta:last"); } catch {}
  const pool = SENTENCES.filter((s) => s.slug !== last);
  return pool[Math.floor(Math.random() * pool.length)];
}

function show(next, animate) {
  sentence = next;
  try { localStorage.setItem("labyrinta:last", sentence.slug); } catch {}
  captionLink.textContent = sentence.text;
  captionLink.href = "#" + sentence.slug;
  note.textContent = sentence.note;
  document.title = `${sentence.text[0].toUpperCase()}${sentence.text.slice(1)} · Labÿrínta`;
  canvas.setAttribute(
    "aria-label",
    `A maze whose corridors spell “${sentence.text}”. It is entered at the top left and left at the bottom right. The arrow keys walk it.`,
  );
  maze = null;
  thread = [0];
  outAt = 0;
  place();
  start = performance.now();
  if (!animate || reduceMotion.matches) start -= 1e6;
  document.body.classList.toggle("carved", !animate || reduceMotion.matches);
  loop();
}

// ---------------------------------------------------------------- geometry

function place(keepLines = false) {
  const vw = innerWidth, vh = innerHeight;
  const narrow = vw < 600;
  const margin = Math.round(Math.min(120, Math.max(20, vw * 0.07)));
  const top = narrow ? 64 : 84; // room for the credit
  const below = narrow ? 120 : 132; // room for the caption
  const boxW = vw - 2 * margin;
  let boxH = Math.max(80, vh - top - below - margin);
  const words = sentence.text.split(" ");
  const maxCell = narrow ? 40 : 52;

  // Lay out, then make sure nothing collides: the maze must clear the credit,
  // and the caption must fit on screen. If not, try again with a smaller box.
  for (let attempt = 0; attempt < 4; attempt++) {
    // A phone's toolbar sliding away changes only the height: keep the same
    // carving (and the thread in it) rather than breaking the lines afresh.
    const fit = keepLines && maze
      ? { lines: maze.lines, cell: Math.min(maxCell, boxW / maze.W, boxH / maze.H) }
      : layout(words, boxW, boxH, maxCell);

    if (!maze || maze.lines.join("/") !== fit.lines.join("/")) {
      maze = carve(fit.lines, sentence.text);
      edges = buildEdges(maze);
      thread = [0];
      outAt = 0;
    }

    const s = Math.max(6, Math.floor(fit.cell));
    const bw = maze.W * s, bh = maze.H * s;
    const left = Math.round((vw - bw) / 2);
    // Centre the carving and its caption together in the space under the credit.
    const groupH = bh + s + below * 0.6;
    let blockTop = Math.round(top + Math.max(0, (vh - top - groupH) / 2 - s));
    const ox = mod(left, s), oy = mod(blockTop, s);

    // The credit, in a clearing in the top left corner of the lattice.
    const cx = ox + s * Math.max(1, Math.ceil((16 - ox) / s));
    const cy = oy + s * Math.max(0, Math.ceil((12 - oy) / s));
    credit.style.cssText = `left:${cx + Math.round(s * 0.5)}px;top:0px;`;
    const crH = credit.offsetHeight, crW = credit.offsetWidth;
    const crRows = Math.max(1, Math.ceil((crH + s * 0.6) / s));
    const crBox = [cx, cy, snapUp(crW + s, s), crRows * s];
    // Push the maze down whole rows (so the lattice stays aligned) until it
    // clears the credit, if they share any columns.
    if (cx + crBox[2] > left && blockTop < cy + crBox[3] + s) {
      blockTop += snapUp(cy + crBox[3] + s - blockTop, s);
    }

    // The caption, in a clearing one row below the maze.
    const capW = Math.max(bw, Math.min(vw - 2 * 16, 34 * 16));
    const capLeft = snapDown(Math.round((vw - capW) / 2) - ox, s) + ox;
    const capRight = snapUp(Math.round((vw + capW) / 2) - ox, s) + ox;
    caption.parentElement.style.cssText = `left:${capLeft}px;width:${capRight - capLeft}px;`;
    const capH = caption.parentElement.offsetHeight;
    const capTop = blockTop + bh + s;
    const rows = Math.max(2, Math.ceil((capH + s) / s));
    const overflow = capTop + rows * s - vh;
    if (overflow > 0 && attempt < 3 && s > 6) {
      boxH = Math.max(40, boxH - overflow - s);
      keepLines = false;
      continue;
    }
    caption.parentElement.style.top = `${capTop + Math.round((rows * s - capH) / 2)}px`;
    credit.style.top = `${cy + Math.round((crRows * s - crH) / 2)}px`;

    const lw = Math.max(2, 2 * Math.round(s / 10));
    geo = { vw, vh, s, lw, left, top: blockTop, bw, bh, ox, oy, clear: [[capLeft, capTop, capRight - capLeft, rows * s], crBox] };
    break;
  }

  const dpr = Math.min(3, devicePixelRatio || 1);
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + "px";
  canvas.style.height = vh + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const mod = (a, n) => ((a % n) + n) % n;
const snapDown = (v, s) => Math.floor(v / s) * s;
const snapUp = (v, s) => Math.ceil(v / s) * s;

// Every segment of the lattice inside the carving: walls that stay, walls that
// are carved away (in the order a flood from the entrance would reach them),
// and the bare lattice of cells no letter uses.
function buildEdges(m) {
  const { W, H, kind, right, down, dist } = m;
  let maxDist = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > maxDist) maxDist = dist[i];
  const exitDist = dist[W * H - 1] + 1;
  const dt = Math.min(48, Math.max(10, 2000 / (maxDist + 1)));
  const carveAt = (d) => 1150 + d * dt;
  const boldAt = (x, y) => 120 + 700 * ((x + y) / (W + H));
  const list = [];
  const add = (x1, y1, x2, y2, type, d) =>
    list.push({ x1, y1, x2, y2, type, bold: boldAt((x1 + x2) / 2, (y1 + y2) / 2), carve: type === 1 ? carveAt(d) : 0 });
  const slack = (x, y) => x < 0 || y < 0 || x >= W || y >= H || kind[y * W + x] === SLACK;
  const d2 = (a, b) => Math.min(dist[a] < 0 ? 1e9 : dist[a], dist[b] < 0 ? 1e9 : dist[b]);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // right edge of this cell
      if (x < W - 1) {
        if (slack(x, y) && slack(x + 1, y)) add(x + 1, y, x + 1, y + 1, 2);
        else add(x + 1, y, x + 1, y + 1, right[i] ? 1 : 0, d2(i, i + 1));
      }
      if (y < H - 1) {
        if (slack(x, y) && slack(x, y + 1)) add(x, y + 1, x + 1, y + 1, 2);
        else add(x, y + 1, x + 1, y + 1, down[i] ? 1 : 0, d2(i, i + W));
      }
    }
  }
  // The frame: open at the top left (the way in) and bottom right (the way out).
  // Where a short line leaves cells unused, the frame steps around the text and
  // the lattice runs on into them.
  for (let x = 0; x < W; x++) {
    add(x, 0, x + 1, 0, slack(x, 0) ? 2 : 0);
    add(x, H, x + 1, H, slack(x, H - 1) ? 2 : 0);
  }
  for (let y = 0; y < H; y++) {
    add(0, y, 0, y + 1, slack(0, y) ? 2 : y === 0 ? 1 : 0, -1);
    add(W, y, W, y + 1, slack(W - 1, y) ? 2 : y === H - 1 ? 1 : 0, exitDist);
  }
  edges = list;
  end = carveAt(exitDist) + 400;
  m.carveAt = carveAt;
  return list;
}

// ---------------------------------------------------------------- drawing

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

function colors() {
  const cs = getComputedStyle(document.documentElement);
  LATTICE_ALPHA = parseFloat(cs.getPropertyValue("--lattice")) || 0.11;
  TONE_ALPHA = parseFloat(cs.getPropertyValue("--tone")) || 0.06;
  return { ink: cs.getPropertyValue("--ink").trim() };
}

function draw(now) {
  const t = now - start;
  const { vw, vh, s, lw, left, top, bw, bh, ox, oy } = geo;
  const { ink } = colors();
  ctx.clearRect(0, 0, vw, vh);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;

  // The lattice: everywhere there is no carving and no clearing.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, vw, vh);
  ctx.rect(left, top, bw, bh);
  for (const [x, y, w, h] of geo.clear) ctx.rect(x, y, w, h);
  ctx.clip("evenodd");
  ctx.globalAlpha = LATTICE_ALPHA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ox; x <= vw; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, vh); }
  for (let y = oy; y <= vh; y += s) { ctx.moveTo(0, y); ctx.lineTo(vw, y); }
  ctx.stroke();
  ctx.restore();

  // A faint tone on the corridors that are not letters, so the letters read
  // as the white ones. It arrives as the flood does.
  const { W, H, kind, dist } = maze;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (kind[i] !== FREE) continue;
      const a = ease((t - maze.carveAt(dist[i])) / 500);
      if (a <= 0) continue;
      ctx.globalAlpha = TONE_ALPHA * a;
      ctx.fillRect(left + x * s, top + y * s, s, s);
    }
  }

  // The carving.
  ctx.lineCap = "square";
  for (const e of edges) {
    let x1 = left + e.x1 * s, y1 = top + e.y1 * s, x2 = left + e.x2 * s, y2 = top + e.y2 * s;
    if (e.type === 2) {
      ctx.globalAlpha = LATTICE_ALPHA;
      ctx.lineWidth = 1;
      ctx.lineCap = "butt";
      line(x1, y1, x2, y2);
      ctx.lineCap = "square";
      continue;
    }
    const b = ease((t - e.bold) / 420);
    let alpha = LATTICE_ALPHA + (1 - LATTICE_ALPHA) * b;
    let width = 1 + (lw - 1) * b;
    if (e.type === 1) {
      const c = ease((t - e.carve) / 320);
      if (c >= 1) continue;
      // Carved walls shrink back into the posts at either end and fade.
      const k = c / 2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      x1 += (mx - x1) * k * 2; y1 += (my - y1) * k * 2;
      x2 += (mx - x2) * k * 2; y2 += (my - y2) * k * 2;
      alpha *= 1 - c;
      width *= 1 - c * 0.5;
      if (c > 0) ctx.lineCap = "butt";
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    line(x1, y1, x2, y2);
    ctx.lineCap = "square";
  }
  drawThread(t);
  ctx.globalAlpha = 1;
  return t;
}

// The thread runs through the middle of the corridors, thinner than the walls
// and with round ends, so it never reads as a wall. Its loose end waits just
// outside the entrance.
function drawThread(t) {
  const a = ease((t - (end - 300)) / 600);
  if (a <= 0) return;
  const { s, left, top } = geo;
  const { W } = maze;
  const cx = (i) => left + ((i % W) + 0.5) * s;
  const cy = (i) => top + (((i / W) | 0) + 0.5) * s;
  ctx.globalAlpha = a;
  ctx.lineWidth = Math.max(1.5, geo.lw * 0.6);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(left - s * 0.9, cy(0));
  for (const i of thread) ctx.lineTo(cx(i), cy(i));
  if (outAt) {
    const k = ease((performance.now() - outAt) / 500);
    const last = thread[thread.length - 1];
    ctx.lineTo(cx(last) + s * 1.4 * k, cy(last));
  }
  ctx.stroke();
  // The head of the thread: a small knot, where you pick it up again.
  if (!outAt) {
    const h = thread[thread.length - 1];
    ctx.beginPath();
    ctx.arc(cx(h), cy(h), Math.max(2.5, geo.lw * 0.9), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineJoin = "miter";
  ctx.lineCap = "square";
}

let LATTICE_ALPHA = 0.11;
let TONE_ALPHA = 0.06;

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function loop() {
  cancelAnimationFrame(frame);
  const tick = (now) => {
    const t = draw(now);
    if (t > end - 500) document.body.classList.add("carved");
    if (t < end || (outAt && now - outAt < 600)) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- events

let resizeTimer = 0;
let lastWidth = innerWidth;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    place(innerWidth === lastWidth);
    lastWidth = innerWidth;
    loop();
  }, 60);
});

// ---------------------------------------------------------------- walking

const linked = (a, b) => {
  const { W, right, down } = maze;
  if (b === a + 1 && a % W !== W - 1) return right[a];
  if (b === a - 1 && b % W !== W - 1) return right[b];
  if (b === a + W) return down[a];
  if (b === a - W) return down[b];
  return 0;
};

// Take one step into a neighbouring cell: forward if it is new, back (winding
// the thread up) if it is where we just came from.
function step(to) {
  if (outAt || !document.body.classList.contains("carved")) return false;
  const head = thread[thread.length - 1];
  if (thread.length > 1 && thread[thread.length - 2] === to) thread.pop();
  else if (linked(head, to)) {
    // Walking into a cell the thread already passes through cuts the loop off.
    const seen = thread.indexOf(to);
    if (seen >= 0) thread.length = seen + 1;
    else thread.push(to);
  } else return false;
  if (thread[thread.length - 1] === maze.W * maze.H - 1) leave();
  loop();
  return true;
}

// Follow the pointer along the corridors: the shortest way from the head of
// the thread to the cell under the finger, if it is close.
function walkTo(target) {
  const head = thread[thread.length - 1];
  if (target === head || target < 0) return;
  const { W, H } = maze;
  const prev = new Map([[head, -1]]);
  let frontier = [head];
  for (let d = 0; d < 6 && !prev.has(target); d++) {
    const next = [];
    for (const i of frontier) {
      for (const j of [i + 1, i - 1, i + W, i - W]) {
        if (j < 0 || j >= W * H || prev.has(j) || !linked(i, j)) continue;
        prev.set(j, i);
        next.push(j);
      }
    }
    frontier = next;
  }
  if (!prev.has(target)) return;
  const route = [];
  for (let i = target; i !== head; i = prev.get(i)) route.unshift(i);
  for (const i of route) if (!step(i)) break;
}

function cellAt(x, y) {
  const { s, left, top } = geo;
  const cx = Math.floor((x - left) / s), cy = Math.floor((y - top) / s);
  if (cx < 0 || cy < 0 || cx >= maze.W || cy >= maze.H) return -1;
  return cy * maze.W + cx;
}

function leave() {
  outAt = performance.now();
  const pool = SENTENCES.filter((s) => s.slug !== sentence.slug);
  const next = pool[Math.floor(Math.random() * pool.length)].slug;
  setTimeout(() => { location.hash = next; }, reduceMotion.matches ? 300 : 1100);
}

let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  const c = cellAt(e.clientX, e.clientY);
  // Pick the thread up anywhere along it (or at the entrance).
  const at = thread.indexOf(c);
  if (at < 0 || outAt) return;
  if (!document.body.classList.contains("carved")) return;
  thread.length = at + 1;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("walking");
  loop();
});
canvas.addEventListener("pointermove", (e) => {
  const c = cellAt(e.clientX, e.clientY);
  if (dragging) walkTo(c);
  else canvas.classList.toggle("can-walk", thread.includes(c) && !outAt);
});
const drop = () => { dragging = false; canvas.classList.remove("walking"); };
canvas.addEventListener("pointerup", drop);
canvas.addEventListener("pointercancel", drop);

const KEYS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
addEventListener("keydown", (e) => {
  const k = KEYS[e.key];
  if (!k || e.metaKey || e.ctrlKey || e.altKey || !maze) return;
  const head = thread[thread.length - 1];
  const x = (head % maze.W) + k[0], y = ((head / maze.W) | 0) + k[1];
  if (x < 0 || y < 0 || x >= maze.W || y >= maze.H) return;
  e.preventDefault();
  step(y * maze.W + x);
});
addEventListener("hashchange", () => {
  const next = SENTENCES.find((s) => s.slug === decodeURIComponent(location.hash.slice(1)));
  if (next) show(next, true);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => loop());

document.documentElement.classList.add("js");
show(pick(), true);
