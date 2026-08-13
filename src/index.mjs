import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRenderer, transformChapter } from "./markdown.mjs";
import { buildHtml, loadCss } from "./document.mjs";
import { renderPdf } from "./render.mjs";

export { loadConfig, findConfig, CONFIG_NAMES } from "./config.mjs";
export { buildHtml, loadCss } from "./document.mjs";

const ASSETS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");

/** Reads every chapter and renders it to HTML, collecting contents entries. */
async function renderChapters(config) {
  const md = createRenderer();
  const chapterByFile = new Map(config.chapters.map((c) => [c.file, c]));
  const docsName = basename(config.docsDir);
  const chapters = [];

  for (const chapter of config.chapters) {
    const raw = await readFile(join(config.docsDir, chapter.file), "utf8");
    // Generator marker comments are noise in a printed handbook.
    const source = raw.replace(/^<!--\s*generated-by:[^>]*-->\s*\n/, "");

    const env = {};
    const tokens = md.parse(source, env);
    const tocEntries = transformChapter(tokens, chapter, { chapterByFile, docsName });
    const body = md.renderer.render(tokens, md.options, env);

    chapters.push({ ...chapter, body, tocEntries });
  }

  return chapters;
}

/**
 * A link to a .md file is dead in a PDF — there is no file to open. Anything
 * naming a chapter has been rewritten by now, so what is left points outside
 * the handbook and is worth reporting rather than shipping unnoticed.
 */
function findDanglingLinks(chapters) {
  return chapters.flatMap((c) =>
    [...c.body.matchAll(/href="([^"]*\.md(?:#[^"]*)?)"/g)].map((m) => `${c.file} -> ${m[1]}`)
  );
}

/**
 * Builds the PDF described by `config` (already normalized by `loadConfig`).
 * Returns `{ outFile, pages, chapters, numbered, dangling }`.
 */
export async function build(config, { log = () => {} } = {}) {
  log(`rendering ${config.chapters.length} chapters…`);
  const chapters = await renderChapters(config);

  const dangling = findDanglingLinks(chapters);
  if (dangling.length) {
    log(`${dangling.length} link(s) still point at a .md file:`);
    for (const link of dangling) log(`  ${link}`);
  }

  const css = await loadCss(config, ASSETS_DIR);
  const tmpDir = await mkdtemp(join(tmpdir(), "rita-pdf-"));

  log("printing to PDF…");
  await mkdir(dirname(config.outFile), { recursive: true });
  const { pages, numbered } = await renderPdf(config, chapters, css, { tmpDir, log });

  return { outFile: config.outFile, pages, numbered, chapters, dangling };
}

export { ASSETS_DIR };
