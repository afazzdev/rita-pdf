import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { escapeHtml } from "./markdown.mjs";

/**
 * One table-of-contents line: title, leader, page number.
 *
 * `pageOf` is null on the measuring pass — the number slot is still emitted, at
 * the same fixed width and holding a non-breaking space, so filling in the real
 * numbers cannot reflow the contents and invalidate them. (An empty slot is a
 * flex item that collapses to zero height, which shortens the whole list.)
 */
function tocLine(id, text, pageOf) {
  const page = pageOf?.get(id) ?? "&nbsp;";
  return `<li><a href="#${id}"><span class="t">${escapeHtml(
    text
  )}</span><span class="leader"></span><span class="p">${page}</span></a></li>`;
}

function buildToc(config, chapters, pageOf) {
  const groups = [];

  for (const part of config.parts) {
    const inPart = chapters.filter((c) => c.part === part.id);
    if (!inPart.length) continue;

    const items = inPart
      .map((c) => {
        const sub = c.tocEntries.map((e) => tocLine(e.id, e.text, pageOf)).join("\n");
        const line = tocLine(c.id, `${c.number}  ${c.shortTitle}`, pageOf);
        return sub ? `${line.replace(/<\/li>$/, "")}\n<ol>\n${sub}\n</ol></li>` : line;
      })
      .join("\n");

    const heading = config.parts.length > 1 ? `<h2>${escapeHtml(part.label)}</h2>\n` : "";
    groups.push(`<div class="${part.className}">\n${heading}<ol>\n${items}\n</ol>\n</div>`);
  }

  return `<section class="toc">\n<h1>Table of Contents</h1>\n${groups.join("\n")}\n</section>`;
}

/** Full-page divider announcing a part, listing the chapters inside it. */
function buildPartDivider(part, chapters) {
  const list = chapters
    .map((c) => `<li><span class="n">${c.number}</span>${escapeHtml(c.shortTitle)}</li>`)
    .join("\n");

  const blurb = part.blurb ? `\n  <p class="part-blurb">${escapeHtml(part.blurb)}</p>` : "";

  return `<section class="part-divider ${part.className}">
  <div class="part-label">${escapeHtml(part.numeral)}</div>
  <h1>${escapeHtml(part.name)}</h1>${blurb}
  <ol>
${list}
  </ol>
</section>`;
}

/**
 * The cover bleeds to the paper edge via a zero-margin named @page, which also
 * keeps the running footer off it — Chrome draws footers in the margin box.
 * (Printing it separately and merging with pdf-lib does the same thing, but
 * drops the PDF's named destinations and kills every internal link.)
 */
function buildCover(config, chapters) {
  const partCards = config.parts
    .map((part) => {
      const count = chapters.filter((c) => c.part === part.id).length;
      if (!count) return "";
      const tagline = part.tagline
        ? `${escapeHtml(part.name)} · ${escapeHtml(part.tagline)}`
        : escapeHtml(part.name);
      return `<div><span class="label">${escapeHtml(
        part.numeral
      )}</span>${tagline}<br>${count} chapter${count === 1 ? "" : "s"}</div>`;
    })
    .filter(Boolean)
    .join("\n      ");

  const cards =
    config.parts.length > 1
      ? `\n    <div class="cover-parts">\n      ${partCards}\n    </div>`
      : "";
  const mark = config.mark ? `\n  <div class="mark">${escapeHtml(config.mark)}</div>` : "";
  const subtitle = config.subtitle
    ? `\n    <div class="subtitle">${escapeHtml(config.subtitle)}</div>`
    : "";

  const meta = [`Generated ${config.date}`, `${chapters.length} chapters`, ...config.meta]
    .map((line) => `    <div>${escapeHtml(line)}</div>`)
    .join("\n");

  // Newlines in the cover title are deliberate line breaks — a long title set
  // as one line shrinks to fit and loses its presence.
  const coverTitle = config.coverTitle
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join("<br>");

  return `<section class="cover">${mark}
  <div class="cover-body">
    <h1>${coverTitle}</h1>${subtitle}${cards}
  </div>
  <div class="meta">
${meta}
  </div>
</section>`;
}

/**
 * Assembles the whole document: cover, contents, part dividers and chapters.
 *
 * @param {import("./config.mjs").ResolvedConfig} config
 * @param {import("./index.mjs").RenderedChapter[]} chapters
 * @param {string} css
 * @param {Map<string, number>|null} [pageOf] Heading id -> printed page. Null on the
 *   measuring pass, when the page numbers are not known yet.
 * @returns {string}
 */
export function buildHtml(config, chapters, css, pageOf = null) {
  const multiPart = config.parts.length > 1;

  const body = config.parts
    .map((part) => {
      const inPart = chapters.filter((c) => c.part === part.id);
      if (!inPart.length) return "";

      const sections = inPart
        .map((c) => {
          const eyebrow = multiPart ? escapeHtml(part.label) : escapeHtml(config.title);
          return `<section class="chapter ${part.className}">
<header class="chapter-head">
  <div class="eyebrow"><span class="n">${c.number}</span><span>${eyebrow}</span></div>
  <h1 id="${c.id}">${escapeHtml(c.shortTitle)}</h1>
</header>
${c.body}
</section>`;
        })
        .join("\n");

      return multiPart ? `${buildPartDivider(part, inPart)}\n${sections}` : sections;
    })
    .join("\n");

  const cover = config.showCover ? `${buildCover(config, chapters)}\n` : "";

  return `<!doctype html>
<html lang="${config.lang ?? "en"}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(config.title)}</title>
<style>${css}</style>
</head>
<body>
${cover}${buildToc(config, chapters, pageOf)}
${body}
</body>
</html>`;
}

/**
 * The stylesheet, with one accent block per configured part appended. Colours
 * live in config, so a project picks its own without forking the theme.
 */
/**
 * @param {import("./config.mjs").ResolvedConfig} config
 * @param {string} assetsDir
 * @returns {Promise<string>}
 */
export async function loadCss(config, assetsDir) {
  const base = config.style
    ? await readFile(config.style, "utf8")
    : await readFile(join(assetsDir, "style.css"), "utf8");

  const accents = config.parts
    .map(
      (part) => `.${part.className} {
  --accent: ${part.accent};
  --accent-tint: ${part.accentTint};
}`
    )
    .join("\n\n");

  return `${base}\n\n/* ---------- Part accents (from config) ---------- */\n\n${accents}\n`;
}
