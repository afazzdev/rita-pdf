import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * A part of the book: one top-level grouping of chapters, with its own divider
 * page and accent colour.
 *
 * @typedef {object} PartConfig
 * @property {string} [id] Matches the top-level directory name. Defaults to a slug of `name`.
 * @property {string} [name] Displayed on the part divider. Defaults to `id`.
 * @property {string} [numeral] "Part I", "Part II"… Numbered in order by default.
 * @property {string} [tagline] Short qualifier shown on the cover card, e.g. "Backend".
 * @property {string} [label] Full label for the contents and chapter eyebrows.
 * @property {string} [blurb] A sentence or two on the part divider.
 * @property {string} [accent] Accent colour. Falls back to a built-in palette, by position.
 * @property {string} [accentTint] Tint used behind blockquotes. Derived from the palette.
 */

/**
 * One chapter: a Markdown file, and where it belongs.
 *
 * @typedef {object} ChapterConfig
 * @property {string} file Path to the Markdown file, relative to the docs directory.
 * @property {string} [part] `id` of the part it belongs to. Defaults to the first part.
 * @property {string} [title] Full title. An "X — Y" title displays as "Y" in the chapter opener.
 */

/**
 * The shape a `rita.config.mjs` exports. Every key is optional — with no config
 * at all, parts and chapters are inferred from the directory tree.
 *
 * @typedef {object} Config
 * @property {string} [docs] Directory of Markdown, relative to the config file. Default `"docs"`.
 * @property {string} [out] Output path. Default `"docs/handbook.pdf"`.
 * @property {string} [title] Cover title and running footer. Default `"Documentation"`.
 * @property {string} [coverTitle] Cover title if it differs; newlines are line breaks.
 * @property {string} [subtitle] Under the cover title.
 * @property {string} [mark] Small label in the cover corner, e.g. "ACME · Internal".
 * @property {string|string[]} [meta] Extra lines in the cover's footer block.
 * @property {string} [footer] Running footer text. Defaults to `title`.
 * @property {string} [date] Date printed on the cover, `YYYY-MM-DD`. Defaults to today —
 *   set it to make a build reproducible.
 * @property {boolean} [cover] Set `false` to print no cover page.
 * @property {string} [lang] `lang` attribute on the document. Default `"en"`.
 * @property {string} [style] Path to a stylesheet replacing the built-in theme.
 * @property {PartConfig[]} [parts] Defaults to one part per top-level directory.
 * @property {ChapterConfig[]} [chapters] Defaults to README-first, then alphabetical.
 * @property {boolean} [strict] With `chapters` listed, an unlisted doc fails the build. Default `true`.
 * @property {string} [executablePath] Browser to print with.
 */

/**
 * A part with every default filled in.
 *
 * @typedef {object} ResolvedPart
 * @property {string} id
 * @property {string} className CSS class carrying this part's accent, e.g. `part-backend`.
 * @property {string} name
 * @property {string} numeral
 * @property {string} tagline
 * @property {string} label
 * @property {string} blurb
 * @property {string} accent
 * @property {string} accentTint
 */

/**
 * A chapter with every default filled in.
 *
 * @typedef {object} ResolvedChapter
 * @property {string} file
 * @property {string} part
 * @property {string} title
 * @property {string} shortTitle Title with any leading "Part — " removed.
 * @property {string} number Two digits, counting from "01" across the whole book.
 * @property {string} id Anchor namespace for this chapter's headings.
 */

/**
 * What {@link loadConfig} returns: absolute paths, no optional keys.
 *
 * @typedef {object} ResolvedConfig
 * @property {string} docsDir
 * @property {string} outFile
 * @property {string} title
 * @property {string} subtitle
 * @property {string} mark
 * @property {string[]} meta
 * @property {string} footer
 * @property {string} coverTitle
 * @property {string} date
 * @property {boolean} showCover
 * @property {ResolvedPart[]} parts
 * @property {ResolvedChapter[]} chapters
 * @property {boolean} quiet
 * @property {string} [lang]
 * @property {string} [style]
 * @property {string} [executablePath]
 */

/** Filenames searched, in order, when no `--config` is given. */
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

/**
 * @param {string} [cwd]
 * @returns {string|null} Path to the first config file found, or null.
 */
export function findConfig(cwd = process.cwd()) {
  for (const name of CONFIG_NAMES) {
    const path = join(cwd, name);
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * `guides/getting-started.md` -> `Getting Started`; `README.md` -> `Overview`.
 *
 * @param {string} file
 * @returns {string}
 */
export function humanizeFile(file) {
  const base = (file.split("/").pop() ?? file).replace(/\.md$/i, "");
  if (/^readme$/i.test(base)) return "Overview";
  if (/^index$/i.test(base)) return "Overview";
  return base
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => (/^[A-Z0-9]+$/.test(word) ? word : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

/**
 * @param {unknown} text
 * @returns {string}
 */
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

/**
 * Reads a config file (if given), layers CLI overrides on top, and fills in
 * every default.
 *
 * @param {object} options
 * @param {string|null} [options.configPath] Config file to read. Nothing is read when omitted.
 * @param {Partial<Config>} [options.overrides] Values winning over the file, e.g. CLI flags.
 * @param {string} [options.cwd] Directory relative paths resolve against.
 * @returns {Promise<ResolvedConfig>}
 */
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
    // Fixed at load time, not read per-render: two passes of the same build
    // must not straddle midnight and disagree.
    date: raw.date ?? new Date().toISOString().slice(0, 10),
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
    label:
      part.label ??
      (part.tagline ? `${numeral} — ${name} (${part.tagline})` : `${numeral} — ${name}`),
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
    // A title of the form "part — Chapter" displays as just "Chapter": the
    // chapter opener already names the part in its eyebrow.
    const shortTitle = chapter.title
      ? (String(chapter.title).split("—").pop() ?? "").trim()
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

/**
 * Per-chapter anchor namespace: `guides/development.md` -> `guides-development`.
 *
 * @param {string} file
 * @returns {string}
 */
export function chapterId(file) {
  return file
    .replace(/\.md$/i, "")
    .replace(/[^\w]+/g, "-")
    .toLowerCase();
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
