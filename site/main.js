// Modules are imported with this file's own ?v= stamp, so a returning visitor
// never pairs a new page with old data.
const v = new URL(import.meta.url).search;
const { POEMS, INK } = await import(`./poems.js${v}`);
const { graph } = await import(`./walls.js${v}`);

const canvas = document.getElementById("lattice");
const ctx = canvas.getContext("2d");
const title = document.getElementById("title");
const numeral = document.getElementById("numeral");
const credit = document.getElementById("credit-line");
const creditBox = document.getElementById("credit");
const heading = document.getElementById("heading");
const nav = document.getElementById("rooms");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const LATTICE_ALPHA = 0.1;
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi"];

// One room per published page. Each maze knows its walls, gaps and way out.
const ROOMS = [];
for (const poem of POEMS) {
  poem.pages.forEach((page, k) => {
    for (const m of page.mazes) m.g = graph(m);
    ROOMS.push({ poem, page, k, n: poem.pages.length, slug: poem.pages.length > 1 ? `${poem.id}-${k + 1}` : poem.id });
  });
}

let room = null;
let threads = []; // per maze: null until entered, then the cells walked from the entrance
let active = 0; // the maze on this page that the thread is in
let outAt = []; // per maze: when its thread left by the exit
let geo = null;
let edges = []; // per maze: the template edges that are carved away
let start = 0, end = 0, frame = 0;

// ---------------------------------------------------------------- rooms

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, val) { try { localStorage.setItem(k, val); } catch {} }
const solved = new Set(JSON.parse(safeGet("labyrinta:solved") || "[]"));

function fromHash() {
  const slug = decodeURIComponent(location.hash.slice(1));
  return ROOMS.find((r) => r.slug === slug) || null;
}

function show(next, animate) {
  room = next;
  safeSet("labyrinta:last", room.slug);
  const { poem, k, n } = room;
  threads = room.page.mazes.map(() => null);
  outAt = room.page.mazes.map(() => 0);
  active = 0;
  title.textContent = poem.title;
  numeral.textContent = n > 1 ? ROMAN[k] : "";
  credit.innerHTML = poem.credit;
  document.title = `${poem.title}${n > 1 ? " " + ROMAN[k] : ""} · Luke Bradford · Labÿrínta`;
  canvas.setAttribute(
    "aria-label",
    `${poem.title}${n > 1 ? ", " + ROMAN[k] + " of " + ROMAN[n - 1] : ""}, a maze poem by Luke Bradford. The arrow keys walk it from the entrance.`,
  );
  renderNav();
  end = 0;
  edges = room.page.mazes.map(buildEdges);
  place();
  start = performance.now();
  if (!animate || reduceMotion.matches) start -= 1e6;
  document.body.classList.toggle("carved", !animate || reduceMotion.matches);
  loop();
}

function renderNav() {
  nav.replaceChildren();
  let last = null;
  for (const r of ROOMS) {
    if (last && last !== r.poem) nav.append(Object.assign(document.createElement("span"), { className: "gap" }));
    last = r.poem;
    const a = document.createElement("a");
    const name = `${r.poem.title}${r.n > 1 ? " " + ROMAN[r.k] : ""}`;
    a.href = "#" + r.slug;
    a.setAttribute("aria-label", name);
    a.title = name;
    if (r === room) a.setAttribute("aria-current", "page");
    if (solved.has(r.slug)) a.classList.add("walked");
    nav.append(a);
  }
}

// ---------------------------------------------------------------- geometry

function place() {
  const vw = innerWidth, vh = innerHeight;
  const narrow = vw < 600;
  const margin = Math.round(Math.min(96, Math.max(18, vw * 0.06)));
  const topRoom = narrow ? 128 : 136; // the credit, then the title
  const bottomRoom = narrow ? 64 : 76; // the row of rooms
  const { W, H } = room.page;
  const boxW = vw - 2 * margin;
  const boxH = Math.max(60, vh - topRoom - bottomRoom);
  const s = Math.min(narrow ? 36 : 44, boxW / W, boxH / H);
  const pw = W * s, ph = H * s;
  const left = Math.round((vw - pw) / 2);
  const top = Math.round(topRoom + (boxH - ph) / 2);
  geo = { vw, vh, s, left, top, pw, ph, ox: mod(left, s), oy: mod(top, s), clear: [] };

  // A clearing of a cell all round the mazes: the lattice never touches the poem.
  geo.clear.push(snapRect(left - s, top - s, pw + 2 * s, ph + 2 * s));

  // The title, centred above the maze, as on the published pages.
  heading.style.cssText = `left:${Math.round(vw / 2)}px;top:0px;`;
  const hh = heading.offsetHeight, hw = heading.offsetWidth;
  const ht = Math.round(Math.max(narrow ? 66 : 72, top - s - hh - Math.max(10, s * 0.4)));
  heading.style.top = `${ht}px`;
  geo.clear.push(snapRect(vw / 2 - hw / 2 - 8, ht - 6, hw + 16, hh + 12));

  // The credit, top left, as on the published pages.
  creditBox.style.cssText = `left:${narrow ? 16 : 24}px;top:${narrow ? 14 : 20}px;max-width:${vw - 32}px;`;
  const cr = creditBox.getBoundingClientRect();
  geo.clear.push(snapRect(cr.left - 8, cr.top - 6, cr.width + 16, cr.height + 12));

  nav.style.cssText = `left:${Math.round(vw / 2)}px;top:${Math.round(Math.min(vh - 34, top + ph + s + 14))}px;`;
  const nr = nav.getBoundingClientRect();
  geo.clear.push(snapRect(nr.left - 8, nr.top - 8, nr.width + 16, nr.height + 16));

  const dpr = Math.min(3, devicePixelRatio || 1);
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
  canvas.style.width = vw + "px";
  canvas.style.height = vh + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Where the page sits, so the drawing can be checked against the published PDFs.
  Object.assign(canvas.dataset, { left, top, s });
}

const mod = (a, n) => ((a % n) + n) % n;
// Grow a rectangle outward to whole cells of the lattice.
function snapRect(x, y, w, h) {
  const { s, ox, oy } = geo;
  const x0 = Math.floor((x - ox) / s) * s + ox, y0 = Math.floor((y - oy) / s) * s + oy;
  const x1 = Math.ceil((x + w - ox) / s) * s + ox, y1 = Math.ceil((y + h - oy) / s) * s + oy;
  return [x0, y0, x1 - x0, y1 - y0];
}

// The edges of the full template lattice that are not walls of the poem. They
// are drawn at first, as in a blank template, and fall away in the order a
// flood from the entrance reaches them. What is left is the poem, exactly.
function buildEdges(m) {
  const { W, H, g } = m;
  let maxDist = 0;
  for (let i = 0; i < g.dist.length; i++) maxDist = Math.max(maxDist, g.dist[i]);
  const dt = Math.min(45, Math.max(4, 2200 / (maxDist + 1)));
  // Cells the entrance cannot reach clear in the second half, sweeping diagonally.
  const when = (i) => (g.dist[i] >= 0 ? g.dist[i] : maxDist * (0.5 + 0.5 * ((i % W) + ((i / W) | 0)) / (W + H)));
  const list = [];
  const add = (h, x, y, a, b) => {
    const d = Math.min(a >= 0 ? when(a) : 1e9, b >= 0 ? when(b) : 1e9);
    list.push({ h, x, y, carve: 1100 + d * dt, bold: 100 + 650 * ((x + y) / (W + H)) });
  };
  for (let y = 0; y <= H; y++) {
    for (let x = 0; x < W; x++) {
      if (!g.hwall[y * W + x]) add(1, x, y, y > 0 ? (y - 1) * W + x : -1, y < H ? y * W + x : -1);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x <= W; x++) {
      if (!g.vwall[y * (W + 1) + x]) add(0, x, y, x > 0 ? y * W + x - 1 : -1, x < W ? y * W + x : -1);
    }
  }
  end = Math.max(end, 1100 + maxDist * dt + 450);
  return list;
}

// ---------------------------------------------------------------- drawing

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

function draw(now) {
  const t = now - start;
  const { vw, vh, s, left, top, ox, oy } = geo;
  ctx.clearRect(0, 0, vw, vh);

  // The lattice, everywhere but the clearings.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, vw, vh);
  for (const [x, y, w, h] of geo.clear) ctx.rect(x, y, w, h);
  ctx.clip("evenodd");
  ctx.strokeStyle = INK;
  ctx.globalAlpha = LATTICE_ALPHA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ox; x <= vw; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, vh); }
  for (let y = oy; y <= vh; y += s) { ctx.moveTo(0, y); ctx.lineTo(vw, y); }
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = "butt";
  const settled = t >= end;
  const b = ease((t - 100) / 1000); // the template darkening
  room.page.mazes.forEach((m, mi) => {
    const mx = left + m.x * s, my = top + m.y * s, sw = m.stroke * s, half = m.stroke / 2;

    // Template edges that are not part of the poem, until they fall away.
    if (!settled) {
      for (const e of edges[mi]) {
        const c = ease((t - e.carve) / 300);
        if (c >= 1) continue;
        const k = ease((t - e.bold) / 420);
        ctx.globalAlpha = (LATTICE_ALPHA + (1 - LATTICE_ALPHA) * k) * (1 - c);
        ctx.lineWidth = 1 + (sw - 1) * k;
        const shrink = c * 0.5;
        ctx.beginPath();
        if (e.h) {
          ctx.moveTo(mx + (e.x - half + shrink) * s, my + e.y * s);
          ctx.lineTo(mx + (e.x + 1 + half - shrink) * s, my + e.y * s);
        } else {
          ctx.moveTo(mx + e.x * s, my + (e.y - half + shrink) * s);
          ctx.lineTo(mx + e.x * s, my + (e.y + 1 + half - shrink) * s);
        }
        ctx.stroke();
      }
    }

    // The poem: every segment exactly as in the published PDF.
    ctx.globalAlpha = settled ? 1 : LATTICE_ALPHA + (1 - LATTICE_ALPHA) * b;
    ctx.lineWidth = settled ? sw : 1 + (sw - 1) * b;
    ctx.beginPath();
    const sg = m.segs;
    for (let j = 0; j < sg.length; j += 4) {
      ctx.moveTo(mx + sg[j] * s, my + sg[j + 1] * s);
      ctx.lineTo(mx + sg[j + 2] * s, my + sg[j + 3] * s);
    }
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  drawThreads(t);
  return t;
}

const OUT = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

// The thread runs through the middle of the corridors, thinner than the walls,
// with round ends. Until it is picked up, its loose end and knot wait outside
// the entrance, off the poem.
function drawThreads(t) {
  const a = ease((t - (end - 400)) / 600);
  if (a <= 0) return;
  const { s, left, top } = geo;
  ctx.globalAlpha = a;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  room.page.mazes.forEach((m, mi) => {
    const { W, g } = m;
    const mx = left + m.x * s, my = top + m.y * s;
    const cx = (i) => mx + ((i % W) + 0.5) * s;
    const cy = (i) => my + (((i / W) | 0) + 0.5) * s;
    const lw = Math.max(1.5, m.stroke * s * 0.6);
    const r = Math.max(2.5, lw * 1.4);
    ctx.lineWidth = lw;
    const [ex, ey] = OUT[g.entrance.side];
    const e0 = g.entrance.cell;
    const th = threads[mi];
    ctx.beginPath();
    ctx.moveTo(cx(e0) + ex * 2.1 * s, cy(e0) + ey * 2.1 * s);
    if (!th) {
      if (mi !== active) return;
      const kx = cx(e0) + ex * 1.25 * s, ky = cy(e0) + ey * 1.25 * s;
      ctx.lineTo(kx, ky);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(kx, ky, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    for (const i of th) ctx.lineTo(cx(i), cy(i));
    const last = th[th.length - 1];
    if (outAt[mi]) {
      const [dx, dy] = OUT[g.exit.side];
      const k = ease((performance.now() - outAt[mi]) / 500);
      ctx.lineTo(cx(last) + dx * 1.6 * s * k, cy(last) + dy * 1.6 * s * k);
    }
    ctx.stroke();
    if (!outAt[mi]) {
      ctx.beginPath();
      ctx.arc(cx(last), cy(last), r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  ctx.globalAlpha = 1;
}

function loop() {
  cancelAnimationFrame(frame);
  const tick = (now) => {
    const t = draw(now);
    if (t > end - 600) document.body.classList.add("carved");
    canvas.dataset.settled = t >= end + 600 ? "1" : "";
    const leaving = outAt.some((o) => o && now - o < 600);
    if (t < end + 650 || leaving) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- walking

const ready = () => document.body.classList.contains("carved");

function enter() {
  if (threads[active] || outAt[active] || !ready()) return false;
  threads[active] = [room.page.mazes[active].g.entrance.cell];
  loop();
  return true;
}

// One step into a neighbouring cell: forward if new, back (winding the thread
// up) if it is where we came from; walking into the thread cuts the loop off.
function step(to) {
  const m = room.page.mazes[active], th = threads[active];
  if (!th || outAt[active] || !ready()) return false;
  const head = th[th.length - 1];
  if (th.length > 1 && th[th.length - 2] === to) th.pop();
  else if (m.g.linked(head, to)) {
    const seen = th.indexOf(to);
    if (seen >= 0) th.length = seen + 1;
    else th.push(to);
  } else return false;
  // A maze with a single gap (Language Is a Trap) has no way out.
  if (m.g.gaps.length > 1 && th[th.length - 1] === m.g.exit.cell) leave();
  loop();
  return true;
}

// Follow the pointer along the corridors, if the cell under it is close.
function walkTo(target) {
  const m = room.page.mazes[active], th = threads[active];
  if (!th || target < 0) return;
  const head = th[th.length - 1];
  if (target === head) return;
  const { W, H } = m;
  const prev = new Map([[head, -1]]);
  let frontier = [head];
  for (let d = 0; d < 8 && !prev.has(target); d++) {
    const next = [];
    for (const i of frontier) {
      for (const j of [i + 1, i - 1, i + W, i - W]) {
        if (j < 0 || j >= W * H || prev.has(j) || !m.g.linked(i, j)) continue;
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

// Out by the exit: on to the next maze on this page, or to the next page.
function leave() {
  outAt[active] = performance.now();
  const more = active < room.page.mazes.length - 1;
  if (!more) {
    solved.add(room.slug);
    safeSet("labyrinta:solved", JSON.stringify([...solved]));
  }
  setTimeout(() => {
    if (more) { active++; loop(); return; }
    location.hash = ROOMS[(ROOMS.indexOf(room) + 1) % ROOMS.length].slug;
  }, reduceMotion.matches ? 300 : 1000);
}

// Which maze, and which cell of it, is under a point.
function at(x, y) {
  const { s, left, top } = geo;
  for (let mi = 0; mi < room.page.mazes.length; mi++) {
    const m = room.page.mazes[mi];
    const cx = Math.floor((x - left) / s - m.x), cy = Math.floor((y - top) / s - m.y);
    if (cx >= 0 && cy >= 0 && cx < m.W && cy < m.H) return { mi, cell: cy * m.W + cx };
  }
  return { mi: -1, cell: -1 };
}

function nearKnot(x, y) {
  if (threads[active] || outAt[active]) return false;
  const m = room.page.mazes[active];
  const { s, left, top } = geo;
  const [ex, ey] = OUT[m.g.entrance.side];
  const i = m.g.entrance.cell;
  const kx = left + (m.x + (i % m.W) + 0.5 + ex * 1.25) * s;
  const ky = top + (m.y + ((i / m.W) | 0) + 0.5 + ey * 1.25) * s;
  return Math.hypot(x - kx, y - ky) < Math.max(22, s);
}

let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  if (!ready()) return;
  const hit = at(e.clientX, e.clientY);
  const m = room.page.mazes[active];
  if (!threads[active]) {
    if (!nearKnot(e.clientX, e.clientY) && !(hit.mi === active && hit.cell === m.g.entrance.cell)) return;
    if (!enter()) return;
  } else {
    if (hit.mi !== active || outAt[active]) return;
    const k = threads[active].indexOf(hit.cell);
    if (k < 0) return;
    threads[active].length = k + 1;
  }
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("walking");
  loop();
});
canvas.addEventListener("pointermove", (e) => {
  const hit = at(e.clientX, e.clientY);
  if (dragging) {
    if (hit.mi === active) walkTo(hit.cell);
    return;
  }
  const th = threads[active];
  const can = ready() && !outAt[active] && ((th && hit.mi === active && th.includes(hit.cell)) || nearKnot(e.clientX, e.clientY));
  canvas.classList.toggle("can-walk", !!can);
});
const drop = () => { dragging = false; canvas.classList.remove("walking"); };
canvas.addEventListener("pointerup", drop);
canvas.addEventListener("pointercancel", drop);

const KEYS = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
addEventListener("keydown", (e) => {
  const k = KEYS[e.key];
  if (!k || e.metaKey || e.ctrlKey || e.altKey || !room) return;
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest("#rooms")) return;
  e.preventDefault();
  if (!threads[active]) { enter(); return; }
  const m = room.page.mazes[active];
  const head = threads[active][threads[active].length - 1];
  const x = (head % m.W) + k[0], y = ((head / m.W) | 0) + k[1];
  if (x < 0 || y < 0 || x >= m.W || y >= m.H) return;
  step(y * m.W + x);
});

// ---------------------------------------------------------------- events

let resizeTimer = 0;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { place(); loop(); }, 60);
});
addEventListener("hashchange", () => {
  const r = fromHash();
  if (r && r !== room) show(r, true);
});

document.documentElement.classList.add("js");
const lastRoom = ROOMS.find((r) => r.slug === safeGet("labyrinta:last"));
show(fromHash() || lastRoom || ROOMS[0], true);
