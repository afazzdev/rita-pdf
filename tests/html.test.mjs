import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.mjs";
import { buildHtml } from "../src/document.mjs";
import { renderChapters } from "../src/index.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

let config;
let chapters;
let html;

beforeAll(async () => {
  config = await loadConfig({
    configPath: null,
    cwd: FIXTURES,
    overrides: { docs: "docs", title: "Fixture Handbook" },
  });
  chapters = await renderChapters(config);
  // No stylesheet: this asserts structure, and 700 lines of CSS in a snapshot
  // would bury it.
  html = buildHtml(config, chapters, "");
});

describe("code blocks", () => {
  it("marks a box-drawing block so its tree stems connect", () => {
    // line-height 1 is the whole point: at anything looser the vertical stems
    // render as a column of disconnected dashes.
    expect(html).toMatch(/<pre class="code[^"]*\btree\b/);
  });

  it("sets a block wider than the column in a smaller size", () => {
    expect(html).toMatch(/<pre class="code[^"]*\bdense-[12]\b/);
  });

  it("leaves an ordinary block alone", () => {
    const plain = [...html.matchAll(/<pre class="([^"]*)">/g)].map((m) => m[1]);

    expect(plain).toContain("code");
  });
});

describe("links", () => {
  it("namespaces heading ids per chapter", () => {
    expect(html).toContain('id="alpha-readme--layout"');
    expect(html).toContain('id="alpha-guides-configuration--narrow-table"');
  });

  it("rewrites a cross-document link to an internal anchor", () => {
    expect(html).toContain('href="#alpha-guides-configuration"');
  });

  it("keeps the fragment when a link carries one", () => {
    expect(html).toContain('href="#alpha-readme--layout"');
  });

  it("turns a bare .md path into a chapter cross-reference", () => {
    expect(html).toMatch(/<a class="xref" href="#alpha-guides-configuration">Chapter 02 — /);
  });

  it("leaves a path that is not a chapter as plain text", () => {
    expect(html).toContain("CONTRIBUTING.md");
    expect(html).not.toContain('href="#contributing"');
  });

  it("leaves no link pointing at a .md file", () => {
    // Such a link cannot work in a PDF: there is no file to open.
    expect(html).not.toMatch(/href="[^"]*\.md(#[^"]*)?"/);
  });
});

describe("structure", () => {
  it("drops each chapter's own table of contents", () => {
    // The front contents already lists every section; the per-chapter copy is a
    // duplicate with no page numbers.
    expect(html).not.toContain("alpha-readme--table-of-contents");
  });

  it("emits a divider and a numbered opener per part", () => {
    expect(html).toContain('class="part-divider part-alpha"');
    expect(html).toContain('class="chapter part-beta"');
    expect(html).toMatch(/<span class="n">01<\/span>/);
  });

  it("leaves the contents' page slots empty until they are known", () => {
    expect(html).toMatch(/<span class="p">&nbsp;<\/span>/);
  });

  it("fills the page numbers in when they are", () => {
    const numbered = buildHtml(config, chapters, "", new Map([[chapters[0].id, 7]]));

    expect(numbered).toMatch(/<span class="p">7<\/span>/);
  });
});

describe("the whole document", () => {
  it("matches the snapshot", () => {
    expect(html).toMatchSnapshot();
  });
});
