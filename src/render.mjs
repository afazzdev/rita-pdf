import { mkdir, writeFile, rm, chmod } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { executablePath, launch } from "puppeteer";
import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";
import { buildHtml } from "./document.mjs";

const require = createRequire(import.meta.url);

/** Locates mermaid's ESM bundle; the exact filename varies between releases. */
function resolveMermaidEntry() {
  const pkg = dirname(require.resolve("mermaid/package.json"));
  const candidates = ["dist/mermaid.esm.min.mjs", "dist/mermaid.esm.mjs", "dist/mermaid.core.mjs"];
  for (const candidate of candidates) {
    const path = join(pkg, candidate);
    if (existsSync(path)) return path;
  }
  throw new Error(`Could not find the mermaid ESM bundle under ${pkg}`);
}

/** Is the system `unzip` available? */
function hasUnzip() {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Makes sure there is a Chromium to print with, downloading one if not.
 *
 * The download happens here rather than in a postinstall script because npm and
 * pnpm both block package build scripts by default now — a tool run through
 * `npx` cannot count on puppeteer's postinstall having fetched a browser. First
 * run pays for the download (~170MB); later runs are offline.
 *
 * The archive is fetched and unpacked as two separate steps. The bundled
 * JS unpacker has been observed to stall — leaving a directory with no `chrome`
 * binary in it, and a promise that never settles — so where the system `unzip`
 * exists it does the unpacking instead.
 */
export async function ensureBrowser(configuredPath, log) {
  const explicit = configuredPath ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`No browser at ${explicit}`);
    return explicit;
  }

  // …/<cacheDir>/chrome/<platform>-<buildId>/chrome-linux64/chrome
  const exe = executablePath();
  if (existsSync(exe)) return exe;

  const installDir = dirname(dirname(exe));
  const archiveDir = dirname(installDir);
  const cacheDir = dirname(archiveDir);
  const buildId = basename(installDir).split("-").slice(1).join("-");

  const { install, Browser } = await import("@puppeteer/browsers");

  log(`downloading Chromium ${buildId} (first run only, ~170MB)…`);
  await install({ browser: Browser.CHROME, buildId, cacheDir, unpack: !hasUnzip() });

  if (!existsSync(exe)) {
    const archive = existsSync(archiveDir)
      ? readdirSync(archiveDir).find((f) => f.endsWith(".zip") && f.includes(buildId))
      : undefined;
    if (!archive) {
      throw new Error(
        `Chromium is missing after download (${exe}).\n` +
          "Point rita-pdf at an existing browser with --browser <path>."
      );
    }

    log("unpacking…");
    await mkdir(installDir, { recursive: true });
    execFileSync("unzip", ["-qo", join(archiveDir, archive), "-d", installDir], {
      stdio: "inherit",
    });

    for (const binary of ["chrome", "chrome_crashpad_handler", "chrome_sandbox"]) {
      const path = join(dirname(exe), binary);
      if (existsSync(path)) await chmod(path, 0o755);
    }
  }

  if (!existsSync(exe)) throw new Error(`Chromium still missing after unpacking: ${exe}`);
  return exe;
}

/**
 * Maps each heading id to the printed page it landed on.
 *
 * Chrome writes one named destination per anchor into the PDF catalog's
 * `/Dests` dictionary, pointing at the page object the anchor ended up on —
 * the only place pagination is knowable, since it happens inside the print
 * layout and not in the DOM.
 */
export async function extractDestinationPages(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes);
  const pageNumberOfRef = new Map(doc.getPages().map((page, i) => [page.ref.toString(), i + 1]));

  const dests = doc.catalog.lookupMaybe(PDFName.of("Dests"), PDFDict);
  const pageOf = new Map();
  if (!dests) return pageOf;

  for (const key of dests.keys()) {
    const target = dests.lookupMaybe(key, PDFArray);
    const pageNumber = target && pageNumberOfRef.get(target.get(0)?.toString());
    if (!pageNumber) continue;
    // PDF name objects print with a leading slash.
    pageOf.set(String(key).slice(1), pageNumber);
  }

  return pageOf;
}

function footerTemplate(text) {
  return `<div style="width:100%;font-size:7pt;color:#8b949e;
    font-family:'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace;
    letter-spacing:0.14em;text-transform:uppercase;
    padding:2mm 18mm 0;display:flex;justify-content:space-between;
    border-top:0.2mm solid #dde3e9;margin:0 18mm;width:auto;flex:1;">
    <span>${text}</span>
    <span style="letter-spacing:0.08em;"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

/** Renders one HTML document to PDF bytes, diagrams and all. */
async function printPass(browser, context, html, name, { quiet = false } = {}) {
  // Served from file:// so the injected mermaid module can import by absolute
  // file URL (its chunks resolve relative to the module, not the page).
  const htmlPath = join(context.tmpDir, name);
  await writeFile(htmlPath, html, "utf8");

  const page = await browser.newPage();
  try {
    page.on("pageerror", (err) => context.log(`[page error] ${err.message}`));

    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 120_000 });
    await page.evaluateHandle("document.fonts.ready");

    const diagrams = await page.$$eval("pre.mermaid", (nodes) => nodes.length);
    if (diagrams > 0) {
      if (!quiet) context.log(`rendering ${diagrams} mermaid diagram(s)…`);
      await page.addScriptTag({
        type: "module",
        content: `
import mermaid from ${JSON.stringify(context.mermaidUrl)};
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  flowchart: { useMaxWidth: true, htmlLabels: true },
});
try {
  await mermaid.run({ querySelector: 'pre.mermaid' });
} catch (err) {
  window.__mermaidError = String(err && err.message ? err.message : err);
}
window.__mermaidDone = true;
`,
      });
      await page.waitForFunction("window.__mermaidDone === true", { timeout: 120_000 });
      const mermaidError = await page.evaluate(() => window.__mermaidError || null);
      if (mermaidError) throw new Error(`Mermaid rendering failed: ${mermaidError}`);

      // A diagram wider than it is tall becomes unreadable squeezed into the
      // portrait text column, so it gets a landscape page of its own.
      const landscaped = await page.$$eval("pre.mermaid", (nodes) => {
        let count = 0;
        for (const node of nodes) {
          const svg = node.querySelector("svg");
          if (!svg) continue;
          const box = svg.viewBox?.baseVal;
          const ratio = box && box.height ? box.width / box.height : 0;
          if (ratio > 1.5) {
            node.classList.add("landscape");
            count++;
          }
        }
        return count;
      });
      if (landscaped && !quiet) {
        context.log(`${landscaped} wide diagram(s) moved to landscape pages`);
      }
    }

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "18mm", bottom: "18mm", left: "18mm", right: "18mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(context.footer),
    });
  } finally {
    await page.close();
  }
}

/**
 * Prints the handbook twice: once to find out which page each heading lands on,
 * then again with those numbers filled into the table of contents. The number
 * slots are the same width on both passes, so the second pass cannot reflow the
 * contents and stale the numbers it is printing. If the passes still disagree
 * on page count, the unnumbered version wins — wrong numbers are worse than
 * none.
 */
export async function renderPdf(config, chapters, css, { tmpDir, log }) {
  await mkdir(tmpDir, { recursive: true });

  const context = {
    tmpDir,
    log,
    footer: config.footer,
    mermaidUrl: pathToFileURL(resolveMermaidEntry()).href,
  };

  const browserPath = await ensureBrowser(config.executablePath, log);
  const browser = await launch({
    headless: true,
    executablePath: browserPath,
    args: ["--no-sandbox", "--allow-file-access-from-files", "--font-render-hinting=none"],
  });

  try {
    const measured = await printPass(
      browser,
      context,
      buildHtml(config, chapters, css),
      "pass-1.html"
    );
    const pageOf = await extractDestinationPages(measured);

    if (!pageOf.size) {
      log("no PDF destinations found — writing the contents without page numbers");
      await writeFile(config.outFile, measured);
      return { pages: (await PDFDocument.load(measured)).getPageCount(), numbered: false };
    }

    log("numbering the table of contents…");
    const final = await printPass(
      browser,
      context,
      buildHtml(config, chapters, css, pageOf),
      "pass-2.html",
      { quiet: true }
    );

    const [before, after] = await Promise.all([
      PDFDocument.load(measured).then((d) => d.getPageCount()),
      PDFDocument.load(final).then((d) => d.getPageCount()),
    ]);
    if (before !== after) {
      log(`pagination shifted (${before} -> ${after} pages) — keeping the unnumbered contents`);
      await writeFile(config.outFile, measured);
      return { pages: before, numbered: false };
    }

    await writeFile(config.outFile, final);
    return { pages: after, numbered: true };
  } finally {
    await browser.close();
    await rm(tmpDir, { recursive: true, force: true });
  }
}
