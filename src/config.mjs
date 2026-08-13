import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CONFIG_NAMES = [
  "rita.config.mjs",
  "rita.config.js",
  "rita.config.json",
  "rita-pdf.config.mjs",
  "rita-pdf.config.js",
  "rita-pdf.config.json",
];

/** Default accents, used in order for parts that do not name their own. */
const PALETTE = [
  { accent: "#123f5c", accentTint: "#e9f0f6" },
  { accent: "#6d3410", accentTint: "#f8efe8" },
  { accent: "#1f4b2c", accentTint: "#e9f2ec" },
  { accent: "#4a2a63", accentTint: "#f1edf8" },
  { accent: "#5c3210", accentTint: "#f6efe8" },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function findConfig(cwd = process.cwd()) {
  for (const name of CONFIG_NAMES) {
    const path = join(cwd, name);
    if (existsSync(path)) return path;
  }
  return null;
}

/** `guides/getting-started.md` -> `Getting Started`; `README.md` -> `Overview`. */
export function humanizeFile(file) {
  const base = file.split("/").pop().replace(/\.md$/i, "");
  if (/^readme$/i.test(base)) return "Overview";
  if (/^index$/i.test(base)) return "Overview";
  return base
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => (/^[A-Z0-9]+$/.test(word) ? word : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

export function slug(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function listMarkdown(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMarkdown(full, base)));
    else if (entry.name.toLowerCase().endsWith(".md")) {
      out.push(relative(base, full).split(/[\\/]/).join("/"));
    }
  }
  return out;
}

/**
 * Orders discovered files the way a reader expects: a directory's own README
 * first, then its files, then its subdirectories — each alphabetically.
 */
function compareDocPaths(a, b) {
  const segsA = a.split("/");
  const segsB = b.split("/");

  for (let i = 0; ; i++) {
    const lastA = i === segsA.length - 1;
    const lastB = i === segsB.length - 1;
    if (lastA && lastB) return segsA[i].localeCompare(segsB[i]);
    if (lastA) return -1; // a file sorts before a subdirectory
    if (lastB) return 1;
    if (segsA[i] !== segsB[i]) return segsA[i].localeCompare(segsB[i]);
  }
}

function isReadme(file) {
  return /(^|\/)(readme|index)\.md$/i.test(file);
}

function sortFiles(files) {
  return [...files].sort((a, b) => {
    const dirA = dirname(a);
    const dirB = dirname(b);
    if (dirA === dirB) {
      if (isReadme(a) !== isReadme(b)) return isReadme(a) ? -1 : 1;
      return a.localeCompare(b);
    }
    return compareDocPaths(a, b);
  });
}

export async function loadConfig({ configPath, overrides = {}, cwd = process.cwd() }) {
  let raw = {};
  let base = cwd;

  if (configPath) {
    const path = isAbsolute(configPath) ? configPath : resolve(cwd, configPath);
    if (!existsSync(path)) throw new Error(`Config not found: ${path}`);
    base = dirname(path);
    raw = path.endsWith(".json")
      ? JSON.parse(await readFile(path, "utf8"))
      : (await import(pathToFileURL(path).href)).default;
    if (typeof raw === "function") raw = await raw();
    if (!raw || typeof raw !== "object") {
      throw new Error(`Config must export an object: ${path}`);
    }
  }

  const merged = { ...raw, ...stripUndefined(overrides) };
  return normalize(merged, base);
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined));
}

async function normalize(raw, base) {
  const docsDir = resolve(base, raw.docs ?? "docs");
  if (!existsSync(docsDir)) {
    throw new Error(`Docs directory not found: ${docsDir}`);
  }

  const onDisk = sortFiles(await listMarkdown(docsDir));
  if (!onDisk.length) throw new Error(`No Markdown files under ${docsDir}`);

  const title = raw.title ?? "Documentation";
  const parts = normalizeParts(raw, onDisk);
  const chapters = normalizeChapters(raw, onDisk, parts);

  // An explicit chapter list is a promise that it covers the docs; an inferred
  // one cannot be wrong, so the check only applies to the former.
  if (raw.chapters && raw.strict !== false) {
    assertCoversDocs(chapters, onDisk);
  }

  return {
    docsDir,
    outFile: resolve(base, raw.out ?? "docs/handbook.pdf"),
    title,
    subtitle: raw.subtitle ?? "",
    mark: raw.mark ?? "",
    meta: [].concat(raw.meta ?? []),
    footer: raw.footer ?? title,
    coverTitle: raw.coverTitle ?? title,
    showCover: raw.cover !== false,
    parts,
    chapters,
    quiet: raw.quiet ?? false,
    executablePath: raw.executablePath,
  };
}

function normalizeParts(raw, files) {
  const declared = raw.parts;

  if (Array.isArray(declared) && declared.length) {
    return declared.map((part, i) => buildPart(part, i));
  }

  // No parts configured: infer one per top-level directory, which is how doc
  // trees are usually split. A flat tree yields a single part, and a single
  // part prints no dividers.
  const dirs = [...new Set(files.map((f) => (f.includes("/") ? f.split("/")[0] : "")))];
  if (dirs.length <= 1) {
    return [buildPart({ id: slug(raw.title ?? "docs"), name: raw.title ?? "Documentation" }, 0)];
  }
  return dirs.map((dir, i) => buildPart({ id: dir, name: dir }, i));
}

function buildPart(part, index) {
  const id = part.id ?? slug(part.name ?? `part-${index + 1}`);
  const name = part.name ?? id;
  const numeral = part.numeral ?? `Part ${ROMAN[index] ?? index + 1}`;
  const colours = PALETTE[index % PALETTE.length];

  return {
    id,
    className: `part-${slug(id)}`,
    name,
    numeral,
    tagline: part.tagline ?? "",
    label: part.label ?? (part.tagline ? `${numeral} — ${name} (${part.tagline})` : `${numeral} — ${name}`),
    blurb: part.blurb ?? "",
    accent: part.accent ?? colours.accent,
    accentTint: part.accentTint ?? colours.accentTint,
  };
}

function normalizeChapters(raw, files, parts) {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const fallback = parts[0];

  const declared = Array.isArray(raw.chapters) && raw.chapters.length ? raw.chapters : null;
  const source =
    declared ??
    files.map((file) => ({
      file,
      part: file.includes("/") ? file.split("/")[0] : fallback.id,
    }));

  return source.map((chapter, i) => {
    const file = typeof chapter === "string" ? chapter : chapter.file;
    if (!file) throw new Error(`Chapter ${i + 1} has no \`file\``);

    const part = byId.get(chapter.part) ?? fallback;
    const shortTitle = chapter.title
      ? String(chapter.title).split("—").pop().trim()
      : humanizeFile(file);

    return {
      file,
      part: part.id,
      title: chapter.title ?? (parts.length > 1 ? `${part.name} — ${shortTitle}` : shortTitle),
      shortTitle,
      number: String(i + 1).padStart(2, "0"),
      id: chapterId(file),
    };
  });
}

/** Per-chapter anchor namespace: `guides/development.md` -> `guides-development`. */
export function chapterId(file) {
  return file.replace(/\.md$/i, "").replace(/[^\w]+/g, "-").toLowerCase();
}

function assertCoversDocs(chapters, onDisk) {
  const listed = new Set(chapters.map((c) => c.file));
  const missing = onDisk.filter((f) => !listed.has(f));
  const stale = [...listed].filter((f) => !onDisk.includes(f));
  if (!missing.length && !stale.length) return;

  const lines = ["the docs directory and the configured chapter list disagree:"];
  for (const f of missing) lines.push(`  file not listed in \`chapters\`: ${f}`);
  for (const f of stale) lines.push(`  listed in \`chapters\` but missing on disk: ${f}`);
  lines.push("", "Add it to `chapters` (where it should appear), or set `strict: false`.");
  throw new Error(lines.join("\n"));
}
