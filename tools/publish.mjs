#!/usr/bin/env node
// Records a change, checks the site, commits, and pushes (which deploys site/).
//
//   node tools/publish.mjs --title "Short title" --summary "What changed and why." \
//     [--detail "One specific change"]... [--co-author "Name <email>"] [--no-push]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "site");
const log = path.join(root, "changes.json");
const MAX_SITE_BYTES = 5 * 1024 * 1024;

function fail(message) {
  console.error(`publish: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { details: [], push: true };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${flag} needs a value`);
      return v;
    };
    if (flag === "--title") args.title = value();
    else if (flag === "--summary") args.summary = value();
    else if (flag === "--detail") args.details.push(value());
    else if (flag === "--co-author") args.coAuthor = value();
    else if (flag === "--no-push") args.push = false;
    else fail(`Unknown argument: ${flag}`);
  }
  if (!args.title || !args.summary) fail("--title and --summary are required");
  return args;
}

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function walk(dir, rel = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), relPath));
    else out.push(relPath);
  }
  return out;
}

// The site is served from a subpath and loads nothing from other origins.
function checkSite() {
  const problems = [];
  const files = walk(site);
  if (!files.includes("index.html")) problems.push("site/index.html is missing");
  let bytes = 0;
  for (const rel of files) {
    const file = path.join(site, rel);
    bytes += fs.statSync(file).size;
    if (!/\.(html|css|js|mjs|svg)$/.test(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/\b(?:href|src|action)\s*=\s*["']\/(?!\/)/g)) {
      problems.push(`${rel}: root-relative URL near "${text.slice(m.index, m.index + 40)}" (use a relative path)`);
    }
    if (/\.(html|svg)$/.test(rel)) {
      for (const m of text.matchAll(/<(?:script|link|img|iframe|source|video|audio)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi)) {
        const tag = m[0];
        if (/<link\b/i.test(tag) && !/rel\s*=\s*["'][^"']*(stylesheet|preload|modulepreload|icon)/i.test(tag)) continue;
        problems.push(`${rel}: loads from another origin: ${tag.slice(0, 100)} (vendor it into site/)`);
      }
    }
    if (/\.(css)$/.test(rel) && /@import\s+url\(\s*["']?(?:https?:)?\/\//i.test(text)) {
      problems.push(`${rel}: @import from another origin (vendor it into site/)`);
    }
  }
  if (bytes > MAX_SITE_BYTES) {
    problems.push(`site/ is ${(bytes / 1048576).toFixed(1)} MB, over the ${MAX_SITE_BYTES / 1048576} MB budget`);
  }
  if (problems.length) fail(`site check failed:\n  ${problems.join("\n  ")}`);
}

// Stamps the pages' own stylesheets and scripts with the change id, so returning
// visitors' browsers fetch new versions instead of pairing new pages with cached assets.
function stampAssets(id) {
  for (const rel of walk(site).filter((f) => f.endsWith(".html"))) {
    const file = path.join(site, rel);
    const html = fs.readFileSync(file, "utf8");
    const stamped = html.replace(/\b(href|src)="([^":?#]+\.(?:css|js|mjs))(?:\?v=\d+)?"/g, `$1="$2?v=${id}"`);
    if (stamped !== html) fs.writeFileSync(file, stamped);
  }
}

// notes/ may reference private files from this laptop; it must never reach the repo.
function checkNotes() {
  const pending = git("add", "-A", "--dry-run").split("\n");
  const tracked = git("ls-files", "notes");
  const leaked = pending.filter((l) => /^add '(notes\/|.*\/notes\/)/.test(l));
  if (leaked.length || tracked) fail(`refusing to commit local-only notes: ${[...leaked, tracked].filter(Boolean).join(", ")}`);
}

const args = parseArgs(process.argv.slice(2));
checkSite();
checkNotes();

const changes = JSON.parse(fs.readFileSync(log, "utf8"));
const change = {
  id: changes.length,
  date: new Date().toISOString(),
  title: args.title,
  summary: args.summary,
  details: args.details,
};
changes.push(change);
fs.writeFileSync(log, JSON.stringify(changes, null, 2) + "\n");
stampAssets(change.id);

const message = [
  `Change ${change.id}: ${change.title}`,
  "",
  change.summary,
  ...(change.details.length ? ["", ...change.details.map((d) => `- ${d}`)] : []),
  ...(args.coAuthor ? ["", `Co-Authored-By: ${args.coAuthor}`] : []),
].join("\n");
git("add", "-A");
git("commit", "-q", "-m", message);
console.log(`Committed change ${change.id}: ${change.title}`);

if (!args.push) {
  console.log("Skipped push (--no-push).");
} else if (!git("remote")) {
  console.log("No git remote configured; skipped push.");
} else {
  execFileSync("git", ["push", "-q"], { cwd: root, stdio: "inherit" });
  console.log("Pushed. GitHub Actions will redeploy the site in a minute or two.");
}
