#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { build } from "../src/index.mjs";
import { findConfig, loadConfig } from "../src/config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(await readFile(join(HERE, "..", "package.json"), "utf8"));

const USAGE = `rita-pdf — bind a directory of Markdown into one typeset PDF handbook

Usage
  rita-pdf [options]
  rita-pdf init [--force]

Options
  -c, --config <path>   Config file (default: rita.config.mjs in the current directory)
  -d, --docs <dir>      Directory of Markdown to bind (default: docs)
  -o, --out <file>      Output PDF path (default: docs/handbook.pdf)
  -t, --title <text>    Handbook title, used on the cover and in the footer
      --browser <path>  Chromium/Chrome executable to print with
  -q, --quiet           Only report the final output path
  -h, --help            Show this help
  -v, --version         Show version

Without a config file rita-pdf infers everything: one part per top-level
directory, chapters ordered README-first then alphabetically. Run \`rita-pdf init\`
to write a config you can edit.

Docs: ${PKG.homepage}`;

const TEMPLATE = `/** @type {import("rita-pdf").Config} */
export default {
  // Where the Markdown lives, and where the PDF goes (both relative to this file).
  docs: "docs",
  out: "docs/handbook.pdf",

  title: "Documentation",
  subtitle: "",
  // Small label in the corner of the cover, e.g. "ACME · Internal".
  mark: "",
  // Extra lines in the cover's footer block.
  meta: [],

  // Optional. One part per top-level directory is inferred when omitted.
  // parts: [
  //   {
  //     id: "backend",           // matches the top-level directory name
  //     name: "backend",
  //     tagline: "Services",     // shown on the cover card
  //     blurb: "What this part covers, in a sentence or two.",
  //     accent: "#123f5c",       // optional; a default palette is used otherwise
  //   },
  // ],

  // Optional. Inferred from the directory tree when omitted; listing chapters
  // explicitly also fixes their order and fails the build if a doc is missing.
  // chapters: [
  //   { part: "backend", file: "backend/README.md", title: "backend — Overview" },
  // ],
};
`;

function fail(message) {
  console.error(`rita-pdf: ${message}`);
  process.exit(1);
}

async function init(force) {
  const path = resolve(process.cwd(), "rita.config.mjs");
  if (existsSync(path) && !force) {
    fail(`${relative(process.cwd(), path)} already exists (use --force to overwrite)`);
  }
  await writeFile(path, TEMPLATE, "utf8");
  console.log(`rita-pdf: wrote ${relative(process.cwd(), path)}`);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    config: { type: "string", short: "c" },
    docs: { type: "string", short: "d" },
    out: { type: "string", short: "o" },
    title: { type: "string", short: "t" },
    browser: { type: "string" },
    quiet: { type: "boolean", short: "q" },
    force: { type: "boolean" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (values.version) {
  console.log(PKG.version);
  process.exit(0);
}
if (positionals[0] === "init") {
  await init(values.force);
  process.exit(0);
}
if (positionals.length) fail(`unknown command: ${positionals[0]}`);

const configPath = values.config ?? findConfig();
const log = values.quiet ? () => {} : (message) => console.log(`rita-pdf: ${message}`);

try {
  const config = await loadConfig({
    configPath,
    overrides: {
      docs: values.docs,
      out: values.out,
      title: values.title,
      executablePath: values.browser,
    },
  });

  if (configPath) log(`config ${relative(process.cwd(), configPath)}`);
  else log("no config found — inferring parts and chapters from the directory tree");

  const result = await build(config, { log });
  console.log(
    `rita-pdf: wrote ${relative(process.cwd(), result.outFile)} — ${result.pages} pages` +
      (result.numbered ? "" : " (contents unnumbered)")
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
