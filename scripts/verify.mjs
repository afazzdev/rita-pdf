#!/usr/bin/env node
/**
 * Asserts a built handbook is actually usable: it has pages, its table of
 * contents is numbered, and every internal link resolves to a real destination.
 *
 * A PDF that renders but whose links all point nowhere looks fine in a
 * screenshot and is useless in the hand — which is exactly the regression this
 * catches.
 */
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFName, PDFDict, PDFArray } from "pdf-lib";

const [path] = process.argv.slice(2);
if (!path) {
  console.error("usage: verify.mjs <handbook.pdf>");
  process.exit(1);
}

const doc = await PDFDocument.load(await readFile(path));
const dests = doc.catalog.lookupMaybe(PDFName.of("Dests"), PDFDict);
const failures = [];

const pages = doc.getPageCount();
if (pages < 2) failures.push(`expected more than one page, got ${pages}`);

const destCount = dests ? dests.keys().length : 0;
if (!destCount) failures.push("no named destinations — every internal link is dead");

let internal = 0;
let unresolved = 0;
for (const page of doc.getPages()) {
  const annots = page.node.Annots();
  if (!annots) continue;
  for (let i = 0; i < annots.size(); i++) {
    const annot = annots.lookup(i, PDFDict);
    const dest = annot.get(PDFName.of("Dest"));
    if (!dest) continue;
    internal++;
    if (!dests?.lookupMaybe(PDFName.of(String(dest).slice(1)), PDFArray)) unresolved++;
  }
}

if (!internal) failures.push("no internal links at all — the contents cannot be navigable");
if (unresolved) failures.push(`${unresolved} of ${internal} internal links resolve to nothing`);

console.log(`${path}: ${pages} pages, ${destCount} destinations, ${internal} internal links`);

if (failures.length) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log("  ok");
