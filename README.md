# rita-pdf

Binds a directory of Markdown into a single typeset PDF handbook — cover, table of contents with
real page numbers, mermaid diagrams, syntax-highlighted code, and cross-references that work.

```bash
npx rita-pdf                       # infer everything from ./docs
npx rita-pdf init                  # write a config to edit
npx rita-pdf --docs manual --out build/manual.pdf
```

No config is required. Point it at a directory of Markdown and it infers one part per top-level
directory, chapters ordered README-first then alphabetically, and writes `docs/handbook.pdf`.

## What you get

- **A cover** that bleeds to the paper edge, and a **part divider** per section of the book.
- **A table of contents with page numbers.** Pagination only exists inside the print layout, so the
  document is printed twice: the first pass is read back to resolve where each heading landed, the
  second prints with the numbers filled in. If the passes disagree on page count the unnumbered
  version wins — wrong page numbers are worse than none.
- **Working links.** Heading ids are namespaced per chapter, so docs that reuse slugs like
  `#configuration` still link to the right one. `../other/doc.md#anchor` links become internal
  jumps, and a bare path like `docs/guides/config.md` written in a code span becomes a
  cross-reference reading "Chapter 7 — Config". Paths that aren't chapters are left alone.
- **Mermaid diagrams** rendered to SVG. A diagram wider than it is tall gets a landscape page,
  because scaled into a portrait column its labels are unreadable.
- **Code that survives print.** Syntax highlighting in a muted palette that still reads in
  greyscale; blocks wider than the column are set smaller so ASCII trees stay aligned rather than
  wrapping; box-drawing blocks get `line-height: 1` so tree stems actually connect.
- **Tables sized by their content**, not equal columns, with a minimum width per column so a heading
  like "Method" is never broken into "Meth / od". Past eight columns a table takes landscape paper.

## Configuration

`rita.config.mjs` in the working directory, or `--config <path>`:

```js
export default {
  docs: "docs",
  out: "docs/handbook.pdf",

  title: "ACME Documentation",
  coverTitle: "ACME\nDocumentation", // newlines are deliberate line breaks
  subtitle: "Everything the platform team needs",
  mark: "ACME · Internal", // small label in the cover corner
  meta: ["v2.4 · updated quarterly"], // extra lines in the cover footer

  parts: [
    {
      id: "backend", // matches the top-level directory name
      name: "backend",
      tagline: "Services", // shown on the cover card
      blurb: "What this part covers.",
      accent: "#123f5c", // optional; a default palette is used otherwise
    },
  ],

  chapters: [{ part: "backend", file: "backend/README.md", title: "backend — Overview" }],
};
```

Everything is optional except that the docs directory must exist.

| Key                        | Default               | Notes                                                               |
| -------------------------- | --------------------- | ------------------------------------------------------------------- |
| `docs`                     | `"docs"`              | Directory of Markdown, relative to the config file                  |
| `out`                      | `"docs/handbook.pdf"` | Output path                                                         |
| `title`                    | `"Documentation"`     | Cover title and running footer                                      |
| `coverTitle`               | `title`               | Newlines become line breaks                                         |
| `subtitle`, `mark`, `meta` | empty                 | Cover text                                                          |
| `footer`                   | `title`               | Running footer text                                                 |
| `date`                     | today                 | Cover date; set it for a reproducible build                         |
| `cover`                    | `true`                | `false` prints no cover                                             |
| `parts`                    | inferred              | One per top-level directory                                         |
| `chapters`                 | inferred              | Listing them fixes the order                                        |
| `strict`                   | `true`                | With `chapters` listed, a doc missing from the list fails the build |
| `style`                    | built-in theme        | Path to a replacement stylesheet                                    |

**Listing `chapters` is a promise that the list covers the docs.** A Markdown file that exists but
is not listed fails the build, so a new doc cannot silently go missing from the handbook. Set
`strict: false` to allow a partial list.

## CLI

```
rita-pdf [options]
rita-pdf init [--force]

-c, --config <path>   Config file (default: rita.config.mjs in the current directory)
-d, --docs <dir>      Directory of Markdown to bind
-o, --out <file>      Output PDF path
-t, --title <text>    Handbook title
    --browser <path>  Chromium/Chrome executable to print with
-q, --quiet           Only report the final output path
```

## As a library

```js
import { loadConfig, build } from "rita-pdf";

const config = await loadConfig({ configPath: "rita.config.mjs" });
const { outFile, pages } = await build(config, { log: console.log });
```

## Requirements

Node 20.11+, and a Chromium to print with. If there isn't one, rita-pdf downloads its own on first
run (~170MB, cached in `~/.cache/puppeteer`); later runs are offline. The download happens at
runtime rather than in a postinstall script because npm and pnpm both block package build scripts by
default now, so a tool run through `npx` cannot count on one having run.

Use `--browser /path/to/chrome` (or `PUPPETEER_EXECUTABLE_PATH`) to print with a browser you already
have and skip the download entirely.

On Linux and macOS the archive is unpacked with the system `unzip` where available — the bundled JS
unpacker has been observed to stall, leaving a browser directory with no executable in it.

## Using it with mise

```toml
# mise.toml
[tools]
"npm:rita-pdf" = "latest"

[tasks."docs:pdf"]
description = "Build the documentation handbook"
run = "rita-pdf --config docs-pdf.config.mjs"
```

## Development

```bash
npm install          # husky installs the pre-commit hook
npm run lint         # oxlint
npm run format       # prettier
npm run typecheck    # tsc, JSDoc only — no build step, no transpile
npm test             # vitest: 36 unit tests, no browser, under a second
npm run build:example  # the slow lane: prints examples/handbook.pdf for real
```

Types are generated from JSDoc into `types/` and committed, so a clone has them and CI can catch a
stale regeneration. The runtime stays plain ESM — the files published are the files that run.

## License

MIT
