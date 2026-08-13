import { posix } from "node:path";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import { chapterId } from "./config.mjs";
import { measureTable } from "./tables.mjs";

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** GitHub-flavoured heading slug, so hand-written `#anchor` links still match. */
function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-");
}

export function createRenderer() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

  // Mermaid fences become <pre class="mermaid"> so the browser can render them
  // to SVG; every other fence renders as a normal code block.
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = (token.info || "").trim().split(/\s+/)[0];
    if (info === "mermaid") {
      return `<pre class="mermaid">${escapeHtml(token.content)}</pre>\n`;
    }

    const lines = token.content.split("\n");
    // Blocks taller than about half a page are allowed to break across pages;
    // holding them together pushes them to the next page and leaves a hole.
    const long = lines.length > 16 ? " long-block" : "";

    // Project trees and aligned comment columns only read correctly unwrapped.
    // Roughly 97 characters fit the text column at the default 8.4pt.
    const widest = Math.max(...lines.map((line) => line.length));
    const dense = widest > 128 ? " dense-2" : widest > 97 ? " dense-1" : "";

    // Box-drawing glyphs fill their em box exactly, so a directory tree's
    // vertical stems only join up when consecutive lines touch.
    const tree = /[─-╿]/.test(token.content) ? " tree" : "";

    if (info && hljs.getLanguage(info)) {
      const { value } = hljs.highlight(token.content, { language: info, ignoreIllegals: true });
      return `<pre class="code${long}${dense}${tree}"><code class="hljs language-${escapeHtml(
        info
      )}">${value}</code></pre>\n`;
    }

    const lang = info ? ` class="language-${escapeHtml(info)}"` : "";
    return `<pre class="code${long}${dense}${tree}"><code${lang}>${escapeHtml(
      token.content
    )}</code></pre>\n`;
  };

  // Column widths come from the content; past eight columns no division rescues
  // a table in the portrait text column, so it gets landscape paper.
  md.renderer.rules.table_open = (tokens, idx) => {
    const { columns, rows, percentages } = measureTable(tokens, idx);

    const classes = [];
    if (columns >= 8) classes.push("landscape-table");
    // A tall table held together jumps to the next page whole, leaving a hole.
    if (rows > 8) classes.push("long-table");

    const cls = classes.length ? ` class="${classes.join(" ")}"` : "";
    const cols = percentages.map((w) => `<col style="width:${w.toFixed(2)}%">`).join("");
    return `<table${cls}><colgroup>${cols}</colgroup>\n`;
  };

  return md;
}

/**
 * Removes a chapter's own "Table of Contents" section — heading and list.
 *
 * Docs carry one because GitHub renders no index of its own. In a bound handbook
 * the front table of contents already lists every chapter and section, so the
 * per-chapter copy is a duplicate list of links with no page numbers sitting
 * between the reader and the content.
 */
function dropTocSection(tokens) {
  const titles = new Set(["table of contents", "contents"]);
  const start = tokens.findIndex(
    (t, i) =>
      t.type === "heading_open" &&
      tokens[i + 1]?.type === "inline" &&
      titles.has(tokens[i + 1].content.trim().toLowerCase())
  );
  if (start === -1) return;

  let end = start + 3;
  while (end < tokens.length && tokens[end].type !== "heading_open") end++;
  tokens.splice(start, end - start);
}

/**
 * Resolves a path written in the docs to the chapter it names, if any.
 *
 * Handles the forms docs use: root-relative (`docs/guides/x.md`), doc-relative
 * (`../guides/x.md`) and bare (`guides/x.md`). Paths outside the handbook
 * resolve to nothing and are left alone — they really are files to go find.
 */
function resolveDocPath(raw, fromFile, chapterByFile, docsName) {
  const path = raw.trim().replace(/^\.\//, "");
  if (!path.toLowerCase().endsWith(".md") || /\s/.test(path)) return null;

  const candidates = [
    path,
    path.replace(new RegExp(`^${docsName}/`), ""),
    posix.normalize(posix.join(posix.dirname(fromFile), path)),
  ];
  for (const candidate of candidates) {
    const chapter = chapterByFile.get(candidate);
    if (chapter) return chapter;
  }
  return null;
}

/** Maps a Markdown link to its in-PDF anchor, or null to leave it untouched. */
function rewriteHref(href, chapter, chapterByFile) {
  const prefix = chapterId(chapter.file);

  if (href.startsWith("#")) return `#${prefix}--${href.slice(1)}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return null;

  const [path, fragment] = href.split("#");
  if (!path || !path.toLowerCase().endsWith(".md")) return null;

  const target = posix.normalize(posix.join(posix.dirname(chapter.file), path));
  if (!chapterByFile.has(target)) return null;

  const targetPrefix = chapterId(target);
  return fragment ? `#${targetPrefix}--${fragment}` : `#${targetPrefix}`;
}

/**
 * Rewrites one chapter's tokens in place:
 *  - drops the leading H1 (it becomes the chapter opener) and the doc's own TOC
 *  - demotes remaining headings one level and namespaces their ids
 *  - rewrites `#anchor` and `../other/doc.md#anchor` links to those ids
 *  - turns bare `.md` path references into cross-references to that chapter
 *
 * Returns the entries this chapter contributes to the front table of contents.
 */
export function transformChapter(tokens, chapter, { chapterByFile, docsName }) {
  const prefix = chapterId(chapter.file);
  const seen = new Map();
  const tocEntries = [];

  const firstH1 = tokens.findIndex((t) => t.type === "heading_open" && t.tag === "h1");
  if (firstH1 !== -1) tokens.splice(firstH1, 3);

  dropTocSection(tokens);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === "heading_open") {
      const originalLevel = Number(token.tag.slice(1));
      const inline = tokens[i + 1];
      const text = inline && inline.type === "inline" ? inline.content.replace(/`/g, "") : "";

      let slug = slugify(text);
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      if (count > 0) slug = `${slug}-${count}`;

      const id = `${prefix}--${slug}`;
      token.attrSet("id", id);
      token.tag = `h${Math.min(originalLevel + 1, 6)}`;
      tokens[i + 2].tag = token.tag;

      // Only top-level sections go into the front TOC — deeper headings would
      // make it several pages long.
      if (originalLevel === 2 && text) tocEntries.push({ id, text });
      continue;
    }

    if (token.type === "inline" && token.children) {
      for (const child of token.children) {
        if (child.type === "link_open") {
          const href = child.attrGet("href");
          if (!href) continue;
          const rewritten = rewriteHref(href, chapter, chapterByFile);
          if (rewritten) child.attrSet("href", rewritten);
          continue;
        }

        // A path written as a code span points at a file the reader of a
        // printed handbook does not have. Where it names a chapter of this
        // book, make it a cross-reference to that chapter instead.
        if (child.type === "code_inline") {
          const target = resolveDocPath(child.content, chapter.file, chapterByFile, docsName);
          if (!target) continue;
          child.type = "html_inline";
          child.content = `<a class="xref" href="#${target.id}">Chapter ${
            target.number
          } — ${escapeHtml(target.shortTitle)}</a>`;
        }
      }
    }
  }

  return tocEntries;
}
